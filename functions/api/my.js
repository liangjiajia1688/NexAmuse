// 当前用户相关内容：我的产品 / 我的帖子 / 我的企业
import { verifyToken } from '../../src/lib/auth.js';
import { getBearer, json, fail, parseRow } from '../../src/lib/db.js';

export async function onRequestGet({ env, request }) {
  const token = getBearer(request);
  const payload = token && await verifyToken(token, env.TOKEN_SECRET);
  if (!payload) return fail('请先登录', 401);

  const type = new URL(request.url).searchParams.get('type') || 'products';

  if (type === 'products') {
    const rows = await env.DB.prepare(
      'SELECT * FROM products WHERE user_id=? ORDER BY created_at DESC'
    ).bind(payload.uid).all();
    return json({ ok: true, items: (rows.results || []).map(parseRow) });
  }
  if (type === 'posts') {
    const rows = await env.DB.prepare(
      'SELECT * FROM forum_posts WHERE user_id=? ORDER BY created_at DESC'
    ).bind(payload.uid).all();
    return json({ ok: true, items: (rows.results || []).map(parseRow) });
  }
  if (type === 'company') {
    const c = await env.DB.prepare('SELECT * FROM companies WHERE user_id=?').bind(payload.uid).first();
    return json({ ok: true, item: c ? parseRow(c) : null });
  }
  return fail('未知类型');
}
