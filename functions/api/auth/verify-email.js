import { json, fail, now } from '../../_lib/db.js';
import { makeToken } from '../../_lib/auth.js';
import { hashCode } from '../../_lib/verify.js';

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

// POST /api/auth/verify-email  { email, code }
// Verifies the 6-digit code and returns a login token.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  if (!email || !code) return fail('Email and verification code are required');
  if (!/^\d{6}$/.test(code)) return fail('Code must be 6 digits');

  const row = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if (!row) return fail('Email not found', 404);

  // Already verified — just issue a token (useful for "resend not needed" flows).
  if (row.email_verified === 1) {
    const token = await makeToken(row.id, env.TOKEN_SECRET);
    return json({ ok: true, token, user: pickUser(row) });
  }

  if (!row.verify_code || !row.verify_expires || row.verify_expires < now()) {
    return fail('Verification code expired. Please request a new one.', 410);
  }

  const codeHash = await hashCode(code);
  if (codeHash !== row.verify_code) {
    return fail('Invalid verification code', 400);
  }

  await env.DB.prepare('UPDATE users SET email_verified=1, verify_code=NULL, verify_expires=NULL WHERE id=?')
    .bind(row.id).run();

  const token = await makeToken(row.id, env.TOKEN_SECRET);
  return json({ ok: true, token, user: pickUser(row) });
}
