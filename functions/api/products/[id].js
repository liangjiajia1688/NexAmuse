// 产品详情
import { json, fail, parseRow } from '../../../src/lib/db.js';

export async function onRequestGet({ env, params }) {
  const p = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(params.id).first();
  if (!p) return fail('产品不存在', 404);

  const author = await env.DB.prepare(
    'SELECT id,username,role FROM users WHERE id = ?'
  ).bind(p.user_id).first();

  return json({ ok: true, product: parseRow(p), author: author || null });
}
