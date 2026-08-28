import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// DELETE /api/comments/:id — allow the comment's own author (logged in) or an admin to remove it.
export async function onRequestDelete(context) {
  const { params, request, env } = context;
  const id = Number(params.id);
  if (!id) return fail('Invalid comment id', 400);

  const user = await authUser(request, env);
  if (!user || !user.id) return fail('Login required', 401);

  try {
    const row = await env.DB.prepare('SELECT id, user_id FROM comments WHERE id=?').bind(id).first();
    if (!row) return fail('Comment not found', 404);
    const isAdmin = user.role === 'admin';
    if (!isAdmin && row.user_id !== user.id) {
      return fail('You can only delete your own comment', 403);
    }
    // Soft-delete: hide from public lists while preserving the record.
    await env.DB.prepare("UPDATE comments SET status='deleted' WHERE id=?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return fail('DB error: ' + e.message, 500);
  }
}
