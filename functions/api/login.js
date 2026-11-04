import { json, fail } from '../_lib/db.js';
import { verifyPassword, makeToken, sessionCookie } from '../_lib/auth.js';

const MAX_FAILS = 5;              // failed attempts allowed …
const LOCK_WINDOW_MS = 15 * 60 * 1000; // … within this window

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim()
    || 'unknown';
}

// Never let bookkeeping failures block a legitimate login.
let _tableReady = false;
async function ensureTable(env) {
  if (_tableReady) return true;
  try {
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS login_attempts (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, identifier TEXT, ip TEXT, ' +
      'ok INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)'
    ).run();
    try {
      await env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(identifier, ip, created_at)'
      ).run();
    } catch (e) { /* index is optional */ }
    _tableReady = true;
    return true;
  } catch (e) {
    return false;
  }
}

async function logAttempt(env, identifier, ip, ok) {
  try {
    await ensureTable(env);
    await env.DB.prepare(
      'INSERT INTO login_attempts (identifier, ip, ok, created_at) VALUES (?,?,?,?)'
    ).bind(identifier, ip, ok ? 1 : 0, Date.now()).run();
  } catch (e) { /* never block login on audit-log failures */ }
}

async function isLockedOut(env, identifier, ip) {
  try {
    await ensureTable(env);
    const since = Date.now() - LOCK_WINDOW_MS;
    const row = await env.DB.prepare(
      'SELECT COUNT(*) c FROM login_attempts WHERE ok=0 AND created_at>? AND (identifier=? OR ip=?)'
    ).bind(since, identifier, ip).first();
    return (row && row.c >= MAX_FAILS) ? Math.ceil(LOCK_WINDOW_MS / 60000) : 0;
  } catch (e) {
    return 0;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

  const identifier = (body.identifier || body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!identifier || !password) return fail('Email/username and password are required');

  const ip = clientIp(request);
  const url = new URL(request.url);

  // Brute-force protection
  const lockMinutes = await isLockedOut(env, identifier, ip);
  if (lockMinutes) {
    return fail(`Too many failed attempts. Try again in ${lockMinutes} minutes.`, 429);
  }

  const row = await env.DB.prepare('SELECT * FROM users WHERE email=? OR username=?')
    .bind(identifier, identifier).first();

  // Same generic message whether the account exists or not.
  if (!row) {
    await logAttempt(env, identifier, ip, false);
    return fail('Invalid credentials', 401);
  }

  const ok = await verifyPassword(password, row.password);
  if (!ok) {
    await logAttempt(env, identifier, ip, false);
    return fail('Invalid credentials', 401);
  }

  if (row.status && ['banned', 'suspended', 'disabled', 'inactive'].includes(String(row.status).toLowerCase())) {
    await logAttempt(env, identifier, ip, false);
    return fail('This account has been disabled.', 403);
  }

  if (row.email_verified !== 1) {
    return fail('Please verify your email before logging in. Check your inbox or request a new code.', 403);
  }

  const token = await makeToken(row.id, env.TOKEN_SECRET, row.token_version || 0);

  // Clear this account/IP's failure history on success.
  try {
    await env.DB.prepare('DELETE FROM login_attempts WHERE ok=0 AND (identifier=? OR ip=?)')
      .bind(identifier, ip).run();
  } catch (e) { /* ignore */ }

  const res = json({
    ok: true,
    token,
    user: {
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role,
      avatar: row.avatar,
      level: row.level,
      points: row.points,
      status: row.status,
      is_super: row.is_super
    }
  });
  // HttpOnly session cookie powers the server-side /admin gate.
  res.headers.set('Set-Cookie', sessionCookie(token, url));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
