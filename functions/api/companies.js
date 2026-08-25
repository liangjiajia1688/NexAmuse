// 企业主页：列表 + 创建/更新
import { verifyToken } from '../../src/lib/auth.js';
import { getBearer, json, fail, parseRow, now } from '../../src/lib/db.js';

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  let rows;
  if (q) {
    rows = await env.DB.prepare('SELECT * FROM companies WHERE name LIKE ? ORDER BY created_at DESC')
      .bind('%' + q + '%').all();
  } else {
    rows = await env.DB.prepare('SELECT * FROM companies ORDER BY created_at DESC').all();
  }
  return json({ ok: true, companies: (rows.results || []).map(parseRow) });
}

export async function onRequestPost({ request, env }) {
  const token = getBearer(request);
  const payload = token && await verifyToken(token, env.TOKEN_SECRET);
  if (!payload) return fail('请先登录', 401);
  if (payload.role !== 'company') return fail('仅企业账号可创建企业主页', 403);

  let body;
  try { body = await request.json(); } catch { return fail('请求格式错误'); }
  const { name, description, logo_url, contact, website, location } = body;
  if (!name) return fail('企业名称必填');

  const exist = await env.DB.prepare('SELECT id FROM companies WHERE user_id = ?').bind(payload.uid).first();
  if (exist) {
    await env.DB.prepare(
      'UPDATE companies SET name=?,description=?,logo_url=?,contact=?,website=?,location=? WHERE user_id=?'
    ).bind(name, description || '', logo_url || '', contact || '', website || '', location || '', payload.uid).run();
    return json({ ok: true, id: exist.id, updated: true });
  }

  const res = await env.DB.prepare(
    'INSERT INTO companies (user_id,name,description,logo_url,contact,website,location,created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(payload.uid, name, description || '', logo_url || '', contact || '', website || '', location || '', now()).run();

  return json({ ok: true, id: res.meta.last_row_id }, 201);
}
