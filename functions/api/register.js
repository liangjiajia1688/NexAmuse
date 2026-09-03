import { json, fail, now } from '../_lib/db.js';
import { hashPassword, makeToken } from '../_lib/auth.js';
import { hashCode } from '../_lib/verify.js';

function pickUser(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    avatar: row.avatar,
    level: row.level,
    points: row.points,
    status: row.status,
    is_super: row.is_super
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
  const email = (body.email || '').trim().toLowerCase();
  const username = (body.username || '').trim();
  const password = body.password || '';
  const code = (body.code || '').trim();
  if (!email || !username || !password) return fail('Email, username and password are required');
  if (password.length < 6) return fail('Password must be at least 6 characters');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Invalid email');

  const existsEmail = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (existsEmail) return fail('Email already registered', 409);
  const existsUser = await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first();
  if (existsUser) return fail('Username already taken', 409);

  // Email verification is now MANDATORY. The code must match the one previously
  // sent via /api/auth/request-code and stored (hashed) in email_codes. There is
  // no fallback "create unverified user" path — any wrong/missing code is rejected.
  if (!code) {
    return fail('Verification code is required. Please click "Send code" first.', 400);
  }
  const rec = await env.DB.prepare('SELECT code_hash, expires FROM email_codes WHERE email=?').bind(email).first();
  if (!rec || !rec.expires || rec.expires < now()) {
    return fail('Verification code expired or not requested. Please click "Send code" to get a new one.', 410);
  }
  const codeHash = await hashCode(code);
  if (codeHash !== rec.code_hash) {
    return fail('Invalid verification code', 400);
  }

  const hash = await hashPassword(password);
  const res = await env.DB.prepare(
    'INSERT INTO users (email,username,password,role,level,status,points,email_verified,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(email, username, hash, 'user', 'Standard', 'active', 1, 1, now()).run();

  const userId = res.meta && res.meta.last_row_id;
  await env.DB.prepare('DELETE FROM email_codes WHERE email=?').bind(email).run();
  const row = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();
  const token = await makeToken(row.id, env.TOKEN_SECRET);
  return json({ ok: true, verified: true, token, user: pickUser(row) }, 201);
}
