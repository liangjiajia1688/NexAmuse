import { json, fail, now } from '../../_lib/db.js';
import { sendEmail } from '../../_lib/email.js';
import { generateCode, hashCode, codeExpiry, verifyEmailHtml } from '../../_lib/verify.js';

// POST /api/auth/send-verify  { email }
// Sends a 6-digit verification code to an unverified user.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) return fail('Email is required');

  const row = await env.DB.prepare('SELECT id, email, username, email_verified FROM users WHERE email=?')
    .bind(email).first();
  if (!row) return fail('Email not registered', 404);
  if (row.email_verified === 1) return fail('Email already verified', 400);

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expires = codeExpiry(15);

  await env.DB.prepare('UPDATE users SET verify_code=?, verify_expires=? WHERE id=?')
    .bind(codeHash, expires, row.id).run();

  const emailResult = await sendEmail({
    to: email,
    subject: 'Your NexAmuse verification code',
    html: verifyEmailHtml(code, row.username)
  }, env);

  return json({
    ok: true,
    email,
    sent: emailResult.ok,
    devCode: emailResult.dev ? code : undefined
  });
}
