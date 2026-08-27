import { json, fail, now } from '../../../_lib/db.js';
import { authUser } from '../../../_lib/auth.js';

export async function onRequestGet(context) {
  const { params, env } = context;
  const articleId = Number(params.id);
  if (!articleId) return fail('Invalid article id', 400);
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, article_id, user_id, name, email, content, created_at
       FROM comments WHERE article_id = ? AND status = 'approved'
       ORDER BY created_at ASC`
    ).bind(articleId).all();
    return json({ comments: results || [] }, 200);
  } catch (e) {
    return fail('DB error: ' + e.message, 500);
  }
}

export async function onRequestPost(context) {
  const { request, params, env } = context;
  const articleId = Number(params.id);
  if (!articleId) return fail('Invalid article id', 400);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid JSON', 400); }

  const content = String(body.content || '').trim();
  let name = String(body.name || '').trim();
  const email = String(body.email || '').trim();

  // Optional: attach logged-in user (frontend token from /api/login)
  const user = authUser(request, env);
  let userId = null;
  if (user && user.id) {
    userId = user.id;
    if (!name) name = user.username || 'Member';
  }

  if (content.length < 2) return fail('Comment cannot be empty', 400);
  if (!name) name = 'Guest';

  try {
    const { success, meta } = await env.DB.prepare(
      `INSERT INTO comments (article_id, user_id, name, email, content, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'approved', ?)`
    ).bind(articleId, userId, name, email, content, now()).run();
    if (!success) return fail('Failed to save comment', 500);
    const id = meta?.last_row_id;
    return json({
      comment: { id, article_id: articleId, user_id: userId, name, email, content, created_at: now() }
    }, 201);
  } catch (e) {
    return fail('DB error: ' + e.message, 500);
  }
}
