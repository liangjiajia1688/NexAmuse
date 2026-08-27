import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const id = params.id;

  // GET — public single article (increments views)
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM articles WHERE id=? AND status=?').bind(id, 'published').first();
    if (!row) return fail('Not found', 404);
    await env.DB.prepare('UPDATE articles SET views = views + 1 WHERE id=?').bind(id).run();
    return json({ article: row });
  }

  // Everything below requires an admin token.
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Unauthorized', 403);

  // DELETE — remove an article
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM articles WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  // PUT — update status (publish / draft)
  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const status = (body.status || '').trim();
    if (status !== 'published' && status !== 'draft') return fail('Invalid status');
    await env.DB.prepare('UPDATE articles SET status=? WHERE id=?').bind(status, id).run();
    return json({ ok: true, status });
  }

  return fail('Method not allowed', 405);
}
