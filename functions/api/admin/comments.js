import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// GET /api/admin/comments — list all comments (admin only) with optional filters.
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Admin access required', 401);

  const url = new URL(request.url);
  const status = url.searchParams.get('status');     // pending | approved | rejected | (empty=all)
  const articleId = url.searchParams.get('article_id');
  const q = (url.searchParams.get('q') || '').trim();

  let sql = `SELECT c.id, c.article_id, c.user_id, c.name, c.email, c.content, c.status, c.created_at,
                    a.title AS article_title, a.slug AS article_slug
             FROM comments c
             LEFT JOIN articles a ON a.id = c.article_id
             WHERE c.status != 'deleted'`;
  const binds = [];
  if (status) { sql += ' AND c.status = ?'; binds.push(status); }
  if (articleId) { sql += ' AND c.article_id = ?'; binds.push(Number(articleId)); }
  if (q) { sql += ' AND (c.content LIKE ? OR c.name LIKE ?)'; binds.push('%' + q + '%', '%' + q + '%'); }
  sql += ' ORDER BY c.created_at DESC LIMIT 300';

  try {
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    const pending = await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE status='pending'").first();
    const approved = await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE status='approved'").first();
    const rejected = await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE status='rejected'").first();
    const all = await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE status != 'deleted'").first();
    return json({
      comments: results || [],
      counts: { pending: pending.c || 0, approved: approved.c || 0, rejected: rejected.c || 0, all: all.c || 0 }
    }, 200);
  } catch (e) {
    return fail('DB error: ' + e.message, 500);
  }
}
