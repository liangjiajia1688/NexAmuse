import { json, fail, now } from '../../_lib/db.js';
import { sendEmail } from '../../_lib/email.js';
import { generateCode, hashCode, codeExpiry, verifyEmailHtml } from '../../_lib/verify.js';

// POST /api/auth/request-code  { email }
// Sends a 6-digit verification code to an email BEFORE the account is created.
// The code is stored in email_codes and later consumed by /api/register.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) return fail('Email is required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Invalid email');

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (exists) return fail('Email already registered', 409);

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expires = codeExpiry(15);

  await env.DB.prepare(
    'INSERT INTO email_codes (email, code_hash, expires, created_at) VALUES (?,?,?,?) ' +
    'ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires=excluded.expires, created_at=excluded.created_at'
  ).bind(email, codeHash, expires, now()).run();

  const emailResult = await sendEmail({
    to: email,
    subject: 'Your NexAmuse verification code',
    html: verifyEmailHtml(code, email.split('@')[0])
  }, env);

  // TEMPORARY fallback: always return the plaintext code so the frontend can
  // show it in a popup. This bypasses real email delivery (Resend domain not
  // yet verified). Once the sending domain is verified, set dev:false here so
  // the popup stops showing and only real emailed codes work.
  return json({
    ok: true,
    sent: emailResult.ok,
    dev: true,
    devCode: code
  });
}
