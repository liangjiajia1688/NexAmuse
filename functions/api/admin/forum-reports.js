import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);

  if (request.method === 'OPTIONS') return json({ ok: true });

  // ── GET: list + stats ───────────────────────────────────────────
  if (request.method === 'GET') {
    const status = url.searchParams.get('status') || 'pending';
    const rows = await env.DB.prepare(
      `SELECT r.*, u.username reporter_name, u.email reporter_email
       FROM forum_reports r LEFT JOIN users u ON u.id=r.reporter_id
       WHERE r.status=? ORDER BY r.created_at DESC LIMIT 100`
    ).bind(status).all();

    const stats = await env.DB.prepare(
      `SELECT
         COUNT(*) total,
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,
         SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) resolved,
         SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) rejected
       FROM forum_reports`
    ).first();

    return json({
      ok: true,
      reports: rows.results || [],
      stats: {
        total: stats ? stats.total : 0,
        pending: stats ? stats.pending : 0,
        resolved: stats ? stats.resolved : 0,
        rejected: stats ? stats.rejected : 0
      }
    });
  }

  // ── PUT: resolve / reject ───────────────────────────────────────
  if (request.method === 'PUT') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const decision = body.decision === 'rejected' ? 'rejected' : 'resolved';
    const exists = await env.DB.prepare('SELECT id FROM forum_reports WHERE id=?').bind(id).first();
    if (!exists) return fail('Report not found', 404);
    await env.DB.prepare(
      'UPDATE forum_reports SET status=?, handled_by=?, handled_at=?, detail=? WHERE id=?'
    ).bind(decision, user.id, now(), (body.note || '') + (body.detail || ''), id).run();
    // Audit log
    await env.DB.prepare(
      'INSERT INTO admin_logs (admin_id,action,target_type,target_id,detail,ip,created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(user.id, 'forum_report_' + decision, 'report', id, 'Handled forum report #' + id, request.headers.get('cf-connecting-ip') || '', now()).run();
    const row = await env.DB.prepare('SELECT * FROM forum_reports WHERE id=?').bind(id).first();
    return json({ ok: true, report: row });
  }

  return fail('Method not allowed', 405);
}
