// 企业详情 + 该企业发布的产品
import { json, fail, parseRow } from '../../../src/lib/db.js';

export async function onRequestGet({ env, params }) {
  const c = await env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(params.id).first();
  if (!c) return fail('企业不存在', 404);

  const owner = await env.DB.prepare('SELECT id,username FROM users WHERE id = ?').bind(c.user_id).first();
  const products = await env.DB.prepare(
    'SELECT * FROM products WHERE user_id=? AND status="active" ORDER BY created_at DESC'
  ).bind(c.user_id).all();

  return json({ ok: true, company: parseRow(c), owner, products: (products.results || []).map(parseRow) });
}
