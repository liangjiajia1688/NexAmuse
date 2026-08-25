// 论坛：帖子列表 + 发帖
import { verifyToken } from '../../src/lib/auth.js';
import { getBearer, json, fail, parseRow, now } from '../../src/lib/db.js';

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  let rows;
  const sql = `SELECT p.*, u.username as author FROM forum_posts p
               LEFT JOIN users u ON p.user_id = u.id `;
  if (category) {
    rows = await env.DB.prepare(sql + 'WHERE p.category=? ORDER BY p.created_at DESC').bind(category).all();
  } else {
    rows = await env.DB.prepare(sql + 'ORDER BY p.created_at DESC').all();
  }
  return json({ ok: true, posts: (rows.results || []).map(parseRow) });
}

export async function onRequestPost({ request, env }) {
  const token = getBearer(request);
  const payload = token && await verifyToken(token, env.TOKEN_SECRET);
  if (!payload) return fail('请先登录后再发帖', 401);

  let body;
  try { body = await request.json(); } catch { return fail('请求格式错误'); }
  const { title, content, category } = body;
  if (!title || !content) return fail('标题和内容必填');

  const res = await env.DB.prepare(
    'INSERT INTO forum_posts (user_id,title,content,category,created_at) VALUES (?,?,?,?,?)'
  ).bind(payload.uid, title, content, category || '综合', now()).run();

  return json({ ok: true, id: res.meta.last_row_id }, 201);
}
