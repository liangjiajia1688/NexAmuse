import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  const list = await env.DB.prepare(
    'SELECT id,title,category,cover,status,published_at,views FROM articles WHERE user_id=? ORDER BY published_at DESC'
  ).bind(user.id).all();
  return json({ articles: list.results || [] });
}
