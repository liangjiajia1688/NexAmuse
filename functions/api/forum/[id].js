// 论坛帖子详情 + 回复
import { verifyToken } from '../../../src/lib/auth.js';
import { getBearer, json, fail, parseRow, now } from '../../../src/lib/db.js';

export async function onRequestGet({ env, params }) {
  const post = await env.DB.prepare('SELECT * FROM forum_posts WHERE id = ?').bind(params.id).first();
  if (!post) return fail('帖子不存在', 404);

  const author = await env.DB.prepare('SELECT id,username,role FROM users WHERE id = ?').bind(post.user_id).first();
  const replies = await env.DB.prepare(
    'SELECT r.*, u.username as author FROM forum_replies r LEFT JOIN users u ON r.user_id = u.id WHERE r.post_id=? ORDER BY r.created_at ASC'
  ).bind(params.id).all();

  return json({
    ok: true,
    post: parseRow(post),
    author: author || null,
    replies: (replies.results || []).map(parseRow),
  });
}

export async function onRequestPost({ request, env, params }) {
  const token = getBearer(request);
  const payload = token && await verifyToken(token, env.TOKEN_SECRET);
  if (!payload) return fail('请先登录后再回复', 401);

  let body;
  try { body = await request.json(); } catch { return fail('请求格式错误'); }
  if (!body.content) return fail('回复内容必填');

  const res = await env.DB.prepare(
    'INSERT INTO forum_replies (post_id,user_id,content,created_at) VALUES (?,?,?,?)'
  ).bind(params.id, payload.uid, body.content, now()).run();

  return json({ ok: true, id: res.meta.last_row_id }, 201);
}
