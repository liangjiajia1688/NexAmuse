import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// GET /api/admin/videos?status=all|active|deleted&limit=&offset=
export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user || (user.role !== 'admin' && !user.is_super)) return fail('Unauthorized', 401);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  let where = '1=1';
  const binds = [];
  if (['active', 'deleted', 'pending', 'rejected'].includes(status)) {
    where = `videos.status='${status}'`;
  }

  const sql = `
    SELECT videos.*, users.username as creator_name, companies.name as company_name
    FROM videos
    LEFT JOIN users ON videos.created_by = users.id
    LEFT JOIN companies ON videos.company_id = companies.id
    WHERE ${where}
    ORDER BY videos.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await env.DB.prepare(sql).bind(...binds, limit, offset).all();
  const countRow = await env.DB.prepare(`SELECT COUNT(*) c FROM videos WHERE ${where}`).bind(...binds).first();

  return json({
    ok: true,
    videos: rows.results || [],
    total: countRow ? countRow.c : 0,
    limit,
    offset
  });
}
