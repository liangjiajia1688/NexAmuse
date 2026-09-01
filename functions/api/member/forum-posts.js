import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// Member forum post management — a supplier can manage only their own threads.
// Scoped strictly by user_id so cross-user edits are impossible.

function canManage(user) {
  return user.role === 'admin' || user.is_super || ['Premium', 'VIP'].includes(user.level);
}

export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (user.status === 'banned') return fail('Account banned', 403);
  if (!canManage(user)) return fail('Forum management requires Premium or VIP membership', 403);

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = 20;
    const offset = (page - 1) * limit;
    const rows = await env.DB.prepare(
      'SELECT id,section_id,title,content,views,replies,pinned,created_at,status FROM forum_threads WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(user.id, limit, offset).all();
    const cnt = await env.DB.prepare('SELECT COUNT(*) c FROM forum_threads WHERE user_id=?').bind(user.id).first();
    return json({ ok: true, threads: rows.results || [], total: cnt.c || 0 });
  }

  const url = new URL(request.url);
  const id = parseInt(url.searchParams.get('id') || '0', 10);
  if (!id) return fail('id is required');

  const existing = await env.DB.prepare('SELECT * FROM forum_threads WHERE id=?').bind(id).first();
  if (!existing) return fail('Thread not found', 404);
  if (existing.user_id !== user.id && !(user.role === 'admin' || user.is_super)) {
    return fail('Forbidden', 403);
  }

  if (request.method === 'PUT') {
    let b;
    try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const title = String(b.title || existing.title || '').trim();
    const content = String(b.content || existing.content || '').trim();
    if (!title || !content) return fail('Title and content are required');
    await env.DB.prepare('UPDATE forum_threads SET title=?, content=? WHERE id=?').bind(title, content, id).run();
    return json({ ok: true, message: 'Thread updated' });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM forum_replies WHERE thread_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM forum_threads WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Thread deleted' });
  }

  return fail('Method not allowed', 405);
}
