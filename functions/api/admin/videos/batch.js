import { json, fail } from '../../../_lib/db.js';
import { authUser } from '../../../_lib/auth.js';

// POST /api/admin/videos/batch
// Body: { action: 'soft_delete', ids: [1,2,3] }
//       { action: 'approve', ids: [1,2,3] }
//       { action: 'reject', ids: [1,2,3] }
export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user || (user.role !== 'admin' && !user.is_super)) return fail('Unauthorized', 401);

  if (request.method !== 'POST') return fail('Method not allowed', 405);

  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
  const ids = (body.ids || []).map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x) && x > 0);
  if (!ids.length) return fail('ids array required', 400);

  const action = (body.action || '').toLowerCase();
  let newStatus;
  if (action === 'soft_delete' || action === 'delete') newStatus = 'deleted';
  else if (action === 'approve') newStatus = 'active';
  else if (action === 'reject') newStatus = 'rejected';
  else if (action === 'pending') newStatus = 'pending';
  else return fail('action must be soft_delete|approve|reject|pending', 400);

  const placeholders = ids.map(() => '?').join(',');
  const ts = Date.now();
  const sql = `UPDATE videos SET status=?, updated_at=? WHERE id IN (${placeholders})`;
  await env.DB.prepare(sql).bind(newStatus, ts, ...ids).run();

  return json({ ok: true, action, affected: ids.length });
}
