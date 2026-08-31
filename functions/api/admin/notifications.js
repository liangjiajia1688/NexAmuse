import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);
  if (request.method === 'OPTIONS') return json({ ok: true });

  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100'
    ).all();
    return json({ ok: true, notifications: rows.results || [] });
  }

  if (request.method === 'POST') {
    let b; try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const title = (b.title || '').trim();
    if (!title) return fail('Title is required');
    const res = await env.DB.prepare(
      'INSERT INTO notifications (user_id,type,title,body,link,is_read,created_at) VALUES (?,?,?,?,?,0,?)'
    ).bind(
      parseInt(b.user_id) || null,
      (b.type || 'system').trim(),
      title,
      (b.body || '').trim(),
      (b.link || '').trim(),
      now()
    ).run();
    const row = await env.DB.prepare('SELECT * FROM notifications WHERE id=?').bind(res.meta.last_row_id).first();
    return json({ ok: true, notification: row }, 201);
  }

  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    await env.DB.prepare('DELETE FROM notifications WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Notification deleted' });
  }

  return fail('Method not allowed', 405);
}
