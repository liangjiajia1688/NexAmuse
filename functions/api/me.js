import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  return json({ user });
}
