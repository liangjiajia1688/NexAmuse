import { json, fail } from '../../../_lib/db.js';
import { authUser } from '../../../_lib/auth.js';

const VALID = ['pending', 'approved', 'rejected', 'spam'];

// PUT /api/admin/comment/:id — change moderation status (admin only)
export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = Number(params.id);
  if (!id) return fail('Invalid comment id', 400);
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Admin access required', 401);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid JSON', 400); }
  const status = String(body.status || '').trim();
  if (!VALID.includes(status)) return fail('Invalid status', 400);

  try {
    const { success } = await env.DB.prepare('UPDATE comments SET status=? WHERE id=?').bind(status, id).run();
    if (!success) return fail('Failed to update', 500);
    return json({ ok: true, id, status });
  } catch (e) {
    return fail('DB error: ' + e.message, 500);
  }
}

// DELETE /api/admin/comment/:id — remove a comment entirely (admin only)
export async function onRequestDelete(context) {
  const { params, request, env } = context;
  const id = Number(params.id);
  if (!id) return fail('Invalid comment id', 400);
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Admin access required', 401);

  try {
    await env.DB.prepare('DELETE FROM comments WHERE id=?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return fail('DB error: ' + e.message, 500);
  }
}
