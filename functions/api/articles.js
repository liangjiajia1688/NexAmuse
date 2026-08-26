import { json, fail, now } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;

  // GET — public list
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const cat = url.searchParams.get('cat');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    let rows;
    if (cat) {
      rows = await env.DB.prepare(
        'SELECT id,title,excerpt,category,cover,author,published_at,views FROM articles WHERE status=? AND category=? ORDER BY published_at DESC LIMIT ?'
      ).bind('published', cat, limit).all();
    } else {
      rows = await env.DB.prepare(
        'SELECT id,title,excerpt,category,cover,author,published_at,views FROM articles WHERE status=? ORDER BY published_at DESC LIMIT ?'
      ).bind('published', limit).all();
    }
    return json({ articles: rows.results || [] });
  }

  // POST — create (auth required)
  if (request.method === 'POST') {
    const user = await authUser(request, env);
    if (!user) return fail('Unauthorized', 401);
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const title = (body.title || '').trim();
    if (!title) return fail('Title is required');
    const excerpt = (body.excerpt || '').trim();
    const content = (body.content || '').trim();
    const category = (body.category || 'industry').trim();
    const cover = (body.cover || '').trim();
    const res = await env.DB.prepare(
      'INSERT INTO articles (title,excerpt,content,category,cover,author,user_id,status,published_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(title, excerpt, content, category, cover, user.username, user.id, 'published', now()).run();
    const id = res.meta && res.meta.last_row_id;
    return json({ id, title, category, cover }, 201);
  }

  return fail('Method not allowed', 405);
}
