import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// GET  /api/forum/:id  → thread detail + replies (bumps views)
// POST /api/forum/:id  → reply to the thread (auth required, level-gated)
export async function onRequest(context) {
  const { request, env, params } = context;
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return fail('Invalid id', 400);

  const thread = await env.DB.prepare(
    `SELECT t.*, s.name AS section, s.slug AS section_slug
     FROM forum_threads t JOIN forum_sections s ON t.section_id = s.id
     WHERE t.id=?`
  ).bind(id).first();
  if (!thread) return fail('Thread not found', 404);

  // ── GET: detail + replies ─────────────────────────────────────
  if (request.method === 'GET') {
    await env.DB.prepare('UPDATE forum_threads SET views=views+1 WHERE id=?').bind(id).run();
    thread.views = (thread.views || 0) + 1;
    const replies = await env.DB.prepare(
      'SELECT id,user_id,username,content,created_at FROM forum_replies WHERE thread_id=? ORDER BY created_at ASC'
    ).bind(id).all();
    return json({ ok: true, thread, replies: replies.results });
  }

  // ── POST: reply ───────────────────────────────────────────────
  if (request.method === 'POST') {
    const user = await authUser(request, env);
    if (!user) return fail('Unauthorized', 401);
    if (user.status === 'banned') return fail('Account banned', 403);

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const content = (body.content || '').trim();
    if (!content || content.length < 2) return fail('Reply too short');
    if (content.length > 2000) return fail('Reply too long (max 2000 chars)');

    // Standard members: 1 reply per account total
    const isAdmin = user.role === 'admin';
    if (user.level !== 'VIP' && user.level !== 'Premium' && !isAdmin) {
      const cnt = await env.DB.prepare(
        'SELECT COUNT(*) c FROM forum_replies WHERE user_id=?'
      ).bind(user.id).first();
      if ((cnt.c || 0) >= 1) return fail('Standard members can post 1 reply per account total', 429);
    }

    const res = await env.DB.prepare(
      'INSERT INTO forum_replies (thread_id,user_id,username,content,created_at) VALUES (?,?,?,?,?)'
    ).bind(id, user.id, user.username, content, now()).run();

    await env.DB.prepare('UPDATE forum_threads SET replies=replies+1 WHERE id=?').bind(id).run();
    await env.DB.prepare('UPDATE users SET points=points+1 WHERE id=?').bind(user.id).run();

    return json({ ok: true, id: res.meta.last_row_id, message: 'Reply posted' }, 201);
  }

  return fail('Method not allowed', 405);
}
