// 二手设备 / 产品：列表 + 发布
import { verifyToken } from '../../src/lib/auth.js';
import { getBearer, json, fail, parseRow, now } from '../../src/lib/db.js';

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = 12;
  const offset = (page - 1) * limit;

  let rows;
  if (category) {
    rows = await env.DB.prepare(
      'SELECT * FROM products WHERE status="active" AND category=? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(category, limit, offset).all();
  } else if (q) {
    rows = await env.DB.prepare(
      'SELECT * FROM products WHERE status="active" AND (title LIKE ? OR description LIKE ?) ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind('%' + q + '%', '%' + q + '%', limit, offset).all();
  } else {
    rows = await env.DB.prepare(
      'SELECT * FROM products WHERE status="active" ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();
  }

  return json({ ok: true, products: (rows.results || []).map(parseRow), page });
}

export async function onRequestPost({ request, env }) {
  const token = getBearer(request);
  const payload = token && await verifyToken(token, env.TOKEN_SECRET);
  if (!payload) return fail('请先登录后再发布', 401);

  let body;
  try { body = await request.json(); } catch { return fail('请求格式错误'); }

  const { title, description, price, cond, category, images, location } = body;
  if (!title) return fail('标题必填');

  const res = await env.DB.prepare(
    'INSERT INTO products (user_id,title,description,price,cond,category,images,location,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(
    payload.uid, title, description || '', price == null ? null : Number(price),
    cond || '', category || '其他', JSON.stringify(images || []),
    location || '', 'active', now()
  ).run();

  return json({ ok: true, id: res.meta.last_row_id }, 201);
}
