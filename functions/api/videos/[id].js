import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// DELETE /api/videos/:id  — soft delete (status='deleted'). Owner or admin only.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'DELETE') return fail('Method not allowed', 405);

  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  const isAdmin = user.role === 'admin' || user.is_super === 1;

  const id = parseInt(context.params.id, 10);
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id=?').bind(id).first();
  if (!v) return fail('Not found', 404);
  if (!isAdmin && v.created_by !== user.id) return fail('Not allowed', 403);

  await env.DB.prepare("UPDATE videos SET status='deleted', updated_at=? WHERE id=?").bind(Date.now(), id).run();
  return json({ ok: true });
}
