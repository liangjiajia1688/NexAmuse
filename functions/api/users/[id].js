import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Unauthorized', 403);

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return fail('Invalid id', 400);

  // DELETE — remove a user
  if (request.method === 'DELETE') {
    if (id === user.id) return fail('Cannot delete your own account');
    await env.DB.prepare('DELETE FROM users WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  // PUT — update role / email
  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const role = (body.role || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    if (role && role !== 'user' && role !== 'admin') return fail('Invalid role');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Invalid email');

    if (role) {
      await env.DB.prepare('UPDATE users SET role=? WHERE id=?').bind(role, id).run();
    }
    if (email) {
      const clash = await env.DB.prepare('SELECT id FROM users WHERE email=? AND id!=?').bind(email, id).first();
      if (clash) return fail('Email already in use', 409);
      await env.DB.prepare('UPDATE users SET email=? WHERE id=?').bind(email, id).run();
    }
    const row = await env.DB.prepare('SELECT id,email,username,role,avatar,created_at FROM users WHERE id=?').bind(id).first();
    return json({ user: row });
  }

  return fail('Method not allowed', 405);
}
