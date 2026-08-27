import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return fail('Method not allowed', 405);

  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Unauthorized', 403);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  let rows;
  if (q) {
    rows = await env.DB.prepare(
      'SELECT id,email,username,role,avatar,level,points,status,created_at FROM users WHERE email LIKE ? OR username LIKE ? ORDER BY created_at DESC'
    ).bind('%' + q + '%', '%' + q + '%').all();
  } else {
    rows = await env.DB.prepare(
      'SELECT id,email,username,role,avatar,level,points,status,created_at FROM users ORDER BY created_at DESC'
    ).all();
  }
  return json({ users: rows.results || [] });
}
