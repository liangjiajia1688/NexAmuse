import { json, fail } from '../../../_lib/db.js';
import { authUser } from '../../../_lib/auth.js';

// PATCH /api/admin/videos/:id  -> moderate (approve | reject)
// DELETE /api/admin/videos/:id -> permanently delete
export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user || (user.role !== 'admin' && !user.is_super)) return fail('Unauthorized', 401);

  const id = parseInt(context.params.id, 10);
  if (!id) return fail('Invalid id', 400);

  // ── Moderate ────────────────────────────────────────────────────────────
  if (request.method === 'PATCH') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const action = (body.action || '').toLowerCase();
    let newStatus;
    if (action === 'approve') newStatus = 'active';
    else if (action === 'reject') newStatus = 'rejected';
    else return fail('action must be approve|reject', 400);

    const v = await env.DB.prepare('SELECT id, status FROM videos WHERE id=?').bind(id).first();
    if (!v) return fail('Not found', 404);

    await env.DB.prepare('UPDATE videos SET status=?, updated_at=? WHERE id=?')
      .bind(newStatus, Date.now(), id).run();
    return json({ ok: true, status: newStatus });
  }

  // ── Hard delete ─────────────────────────────────────────────────────────
  if (request.method === 'DELETE') {
    const v = await env.DB.prepare('SELECT id FROM videos WHERE id=?').bind(id).first();
    if (!v) return fail('Not found', 404);
    await env.DB.prepare('DELETE FROM videos WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  return fail('Method not allowed', 405);
}
