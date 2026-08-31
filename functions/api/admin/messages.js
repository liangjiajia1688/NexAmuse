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
    const box = url.searchParams.get('box') || 'inbox';
    let where;
    if (box === 'sent') where = 'WHERE m.from_id=?';
    else if (box === 'unread') where = 'WHERE m.to_id=? AND m.is_read=0';
    else where = 'WHERE m.to_id=?';
    const rows = await env.DB.prepare(
      `SELECT m.*, fu.username from_name, tu.username to_name
       FROM messages m
       LEFT JOIN users fu ON fu.id=m.from_id
       LEFT JOIN users tu ON tu.id=m.to_id
       ${where} ORDER BY m.created_at DESC LIMIT 100`
    ).bind(user.id).all();
    return json({ ok: true, messages: rows.results || [], box });
  }

  if (request.method === 'POST') {
    let b; try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const toId = parseInt(b.to_id || '0', 10);
    const body = (b.body || '').trim();
    if (!toId) return fail('Recipient is required');
    if (!body) return fail('Message body is required');
    const res = await env.DB.prepare(
      'INSERT INTO messages (from_id,to_id,subject,body,is_read,parent_id,created_at) VALUES (?,?,?,?,0,?,?)'
    ).bind(user.id, toId, (b.subject || '').trim(), body, parseInt(b.parent_id) || null, now()).run();
    // mark parent read if this is a reply
    if (b.parent_id) {
      await env.DB.prepare('UPDATE messages SET is_read=1 WHERE id=?').bind(parseInt(b.parent_id)).run();
    }
    const row = await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(res.meta.last_row_id).first();
    return json({ ok: true, message: row }, 201);
  }

  if (request.method === 'PUT') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    await env.DB.prepare('UPDATE messages SET is_read=1 WHERE id=? AND to_id=?').bind(id, user.id).run();
    return json({ ok: true });
  }

  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    await env.DB.prepare('DELETE FROM messages WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Message deleted' });
  }

  return fail('Method not allowed', 405);
}
