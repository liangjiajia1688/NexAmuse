import { json, fail } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return fail('Method not allowed', 405);
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '30', 10);
  const cat = url.searchParams.get('cat');
  let rows;
  if (cat) {
    rows = await env.DB.prepare("SELECT id,title,summary,url,source,category,published_at FROM news WHERE status='published' AND category=? ORDER BY published_at DESC LIMIT ?").bind(cat, limit).all();
  } else {
    rows = await env.DB.prepare("SELECT id,title,summary,url,source,category,published_at FROM news WHERE status='published' ORDER BY published_at DESC LIMIT ?").bind(limit).all();
  }
  return json({ news: rows.results || [] });
}
