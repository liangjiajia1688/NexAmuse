import { json, fail, now } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return json({ ok: true });
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const message = (body.message || '').trim();
  if (!name) return fail('Please enter your name');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Please enter a valid email');
  if (!message) return fail('Please enter a message');

  const subject = (body.subject || 'Website inquiry').trim();
  const res = await env.DB.prepare(
    'INSERT INTO contacts (name,email,subject,message,status,created_at) VALUES (?,?,?,?,?,?)'
  ).bind(name, email, subject, message, 'new', now()).run();

  return json({ ok: true, message: 'Thank you — we will get back to you shortly.' }, 201);
}
