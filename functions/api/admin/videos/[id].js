import { json, fail } from '../../../_lib/db.js';
import { authUser } from '../../../_lib/auth.js';

// DELETE /api/admin/videos/:id -> permanently delete a video (admin only)
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'DELETE') return fail('Method not allowed', 405);

  const user = await authUser(request, env);
  if (!user || (user.role !== 'admin' && !user.is_super)) return fail('Unauthorized', 401);

  const id = parseInt(context.params.id, 10);
  if (!id) return fail('Invalid id', 400);

  const v = await env.DB.prepare('SELECT id FROM videos WHERE id=?').bind(id).first();
  if (!v) return fail('Not found', 404);

  await env.DB.prepare('DELETE FROM videos WHERE id=?').bind(id).run();
  return json({ ok: true });
}
