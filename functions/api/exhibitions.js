import { json, fail } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return fail('Method not allowed', 405);
  const rows = await env.DB.prepare('SELECT * FROM exhibitions ORDER BY startDate ASC').all();
  return json({ exhibitions: rows.results || [] });
}
