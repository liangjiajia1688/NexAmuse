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
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const action = url.searchParams.get('action');
    const where = action ? 'WHERE action=?' : '';
    const binds = action ? [action] : [];
    const rows = await env.DB.prepare(
      `SELECT l.*, u.username admin_name, u.email admin_email
       FROM admin_logs l LEFT JOIN users u ON u.id=l.admin_id
       ${where} ORDER BY l.created_at DESC LIMIT ?`
    ).bind(...binds, limit).all();

    const stats = await env.DB.prepare(
      `SELECT
         COUNT(*) total,
         COUNT(DISTINCT date(created_at,'unixepoch')) days,
         SUM(CASE WHEN created_at >= strftime('%s','now')-86400 THEN 1 ELSE 0 END) last24,
         COUNT(DISTINCT admin_id) actors
       FROM admin_logs`
    ).first();

    // Action breakdown for the sidebar.
    const breakdown = await env.DB.prepare(
      'SELECT action, COUNT(*) c FROM admin_logs GROUP BY action ORDER BY c DESC LIMIT 8'
    ).all();

    return json({
      ok: true,
      logs: rows.results || [],
      stats: {
        total: stats ? stats.total : 0,
        days: stats ? stats.days : 0,
        last24: stats ? stats.last24 : 0,
        actors: stats ? stats.actors : 0
      },
      breakdown: breakdown.results || []
    });
  }

  return fail('Method not allowed', 405);
}

// Helper used by other admin endpoints to record an audit entry.
export async function logAdmin(env, adminId, action, targetType, targetId, detail, ip) {
  try {
    await env.DB.prepare(
      'INSERT INTO admin_logs (admin_id,action,target_type,target_id,detail,ip,created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(adminId, action, targetType, targetId || null, detail || '', ip || '', now()).run();
  } catch (e) { /* non-fatal */ }
}
