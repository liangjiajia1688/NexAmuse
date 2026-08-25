// 获取当前登录用户信息
import { verifyToken } from '../../src/lib/auth.js';
import { getBearer, json, fail, parseRow } from '../../src/lib/db.js';

export async function onRequestGet({ request, env }) {
  const token = getBearer(request);
  const payload = token && await verifyToken(token, env.TOKEN_SECRET);
  if (!payload) return fail('未登录', 401);

  const user = await env.DB.prepare(
    'SELECT id,email,username,role,created_at FROM users WHERE id = ?'
  ).bind(payload.uid).first();
  if (!user) return fail('用户不存在', 401);

  let company = null;
  if (user.role === 'company') {
    company = await env.DB.prepare('SELECT * FROM companies WHERE user_id = ?').bind(user.id).first();
  }

  return json({ ok: true, user: parseRow(user), company: company ? parseRow(company) : null });
}
