// 新闻列表（前端展示）
import { json } from '../../src/lib/db.js';

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20'));
  let rows;
  if (category) {
    rows = await env.DB.prepare(
      'SELECT * FROM news WHERE category=? ORDER BY published_at DESC LIMIT ?'
    ).bind(category, limit).all();
  } else {
    rows = await env.DB.prepare(
      'SELECT * FROM news ORDER BY published_at DESC LIMIT ?'
    ).bind(limit).all();
  }
  return json({ ok: true, news: (rows.results || []) });
}
