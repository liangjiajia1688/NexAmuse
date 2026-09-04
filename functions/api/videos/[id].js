import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// DELETE /api/videos/:id  — soft delete (status='deleted'). Owner or admin only.
// PATCH /api/videos/:id {action:'restore'} — restore soft-deleted video to pending.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'DELETE' && request.method !== 'PATCH') return fail('Method not allowed', 405);

  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  const isAdmin = user.role === 'admin' || user.is_super === 1;

  const id = parseInt(context.params.id, 10);
  const v = await env.DB.prepare('SELECT * FROM videos WHERE id=?').bind(id).first();
  if (!v) return fail('Not found', 404);

  // Allow: admin, the user who added it, or the company owner (for company videos)
  let isOwner = false;
  if (v.company_id) {
    const c = await env.DB.prepare('SELECT owner_id FROM companies WHERE id=?').bind(v.company_id).first();
    isOwner = c && c.owner_id === user.id;
  }
  if (!isAdmin && v.created_by !== user.id && !isOwner) return fail('Not allowed', 403);

  if (request.method === 'DELETE') {
    await env.DB.prepare("UPDATE videos SET status='deleted', updated_at=? WHERE id=?").bind(Date.now(), id).run();
    return json({ ok: true });
  }

  // PATCH restore
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const action = (body.action || '').toLowerCase();
  if (action === 'restore') {
    await env.DB.prepare("UPDATE videos SET status='active', updated_at=? WHERE id=?").bind(Date.now(), id).run();
    return json({ ok: true });
  }
  return fail('action must be restore', 400);
}
