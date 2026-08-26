import { json, fail } from '../_lib/db.js';
import { verifyPassword, makeToken } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
  const identifier = (body.identifier || body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!identifier || !password) return fail('Email/username and password are required');

  const row = await env.DB.prepare('SELECT * FROM users WHERE email=? OR username=?')
    .bind(identifier, identifier).first();
  if (!row) return fail('Invalid credentials', 401);
  const ok = await verifyPassword(password, row.password);
  if (!ok) return fail('Invalid credentials', 401);

  const token = await makeToken(row.id, env.TOKEN_SECRET);
  return json({
    token,
    user: { id: row.id, email: row.email, username: row.username, role: row.role, avatar: row.avatar }
  });
}
