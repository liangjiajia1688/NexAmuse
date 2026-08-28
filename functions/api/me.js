import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);

  const threadsCount = await env.DB.prepare('SELECT COUNT(*) c FROM forum_threads WHERE user_id=?').bind(user.id).first();
  const repliesCount = await env.DB.prepare('SELECT COUNT(*) c FROM forum_replies WHERE user_id=?').bind(user.id).first();
  user.threads_count = threadsCount?.c || 0;
  user.replies_count = repliesCount?.c || 0;

  return json({ user });
}
