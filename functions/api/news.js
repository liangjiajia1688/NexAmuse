import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '30', 10);
    const cat = url.searchParams.get('cat');
    const manage = url.searchParams.get('manage') === '1';

    // Admin full list (including pending) for the management screen.
    if (manage) {
      const u = await authUser(request, env);
      if (!u || u.role !== 'admin') return fail('Unauthorized', 401);
      const rows = await env.DB.prepare(
        'SELECT id, title, summary, url, source, category, status, published_at FROM news ORDER BY published_at DESC LIMIT ?'
      ).bind(limit).all();
      return json({ ok: true, news: rows.results || [] });
    }

    let rows;
    if (cat) {
      rows = await env.DB.prepare("SELECT id,title,summary,url,source,category,published_at FROM news WHERE status='published' AND category=? ORDER BY published_at DESC LIMIT ?").bind(cat, limit).all();
    } else {
      rows = await env.DB.prepare("SELECT id,title,summary,url,source,category,published_at FROM news WHERE status='published' ORDER BY published_at DESC LIMIT ?").bind(limit).all();
    }
    return json({ news: rows.results || [] });
  }

  // ── POST /api/news ── admin manually adds a story
  if (method === 'POST') {
    const u = await authUser(request, env);
    if (!u || u.role !== 'admin') return fail('Unauthorized', 401);
    let b;
    try { b = await request.json(); } catch (e) { return fail('Invalid JSON', 400); }
    const title = (b.title || '').trim();
    if (!title) return fail('Title required', 400);
    const status = b.status === 'pending' ? 'pending' : 'published';
    const res = await env.DB.prepare(
      'INSERT INTO news (title, summary, url, source, image, category, status, published_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(
      title,
      (b.summary || '').slice(0, 500),
      b.url && b.url.trim() ? b.url.trim() : null,
      (b.source || 'NexAmuse').trim(),
      b.image || null,
      (b.category || 'industry').trim(),
      status,
      b.published_at ? (Date.parse(b.published_at) || Date.now()) : Date.now(),
      Date.now()
    ).run();
    return json({ ok: true, id: res.meta && res.meta.last_row_id, status });
  }

  return fail('Method not allowed', 405);
}
