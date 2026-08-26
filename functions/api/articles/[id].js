import { json, fail } from '../../_lib/db.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== 'GET') return fail('Method not allowed', 405);
  const id = params.id;
  const row = await env.DB.prepare('SELECT * FROM articles WHERE id=? AND status=?').bind(id, 'published').first();
  if (!row) return fail('Not found', 404);
  await env.DB.prepare('UPDATE articles SET views = views + 1 WHERE id=?').bind(id).run();
  return json({ article: row });
}
