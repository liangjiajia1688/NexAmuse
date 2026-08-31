import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

function pickRule(row) {
  return {
    id: row.id,
    action: row.action,
    points: row.points,
    frequency: row.frequency,
    min_level: row.min_level,
    active: row.active ? 1 : 0,
    sort_order: row.sort_order || 0
  };
}

// GET    /api/admin/point-rules        → list rules (admin)
// POST   /api/admin/point-rules        → create rule
// PUT    /api/admin/point-rules?id=X   → update rule
// DELETE /api/admin/point-rules?id=X   → delete rule
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);

  if (request.method === 'OPTIONS') return json({ ok: true });

  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM point_rules ORDER BY sort_order ASC, id ASC'
    ).all();
    return json({ ok: true, rules: (rows.results || []).map(pickRule) });
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const action = (body.action || '').trim();
    if (!action) return fail('Action name is required');
    const points = parseInt(body.points, 10);
    if (!Number.isFinite(points)) return fail('Invalid points value');

    const maxRow = await env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) m FROM point_rules').first();
    const res = await env.DB.prepare(
      `INSERT INTO point_rules (action, points, frequency, min_level, active, sort_order, updated_at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(
      action,
      points,
      (body.frequency || '').trim() || null,
      (body.min_level || 'All').trim(),
      body.active === false || body.active === 0 ? 0 : 1,
      (maxRow ? maxRow.m : 0) + 1,
      now()
    ).run();

    const row = await env.DB.prepare('SELECT * FROM point_rules WHERE id=?').bind(res.meta.last_row_id).first();
    return json({ ok: true, rule: pickRule(row) }, 201);
  }

  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const id = parseInt(url.searchParams.get('id') || body.id || '0', 10);
    if (!id) return fail('Invalid id', 400);

    const exists = await env.DB.prepare('SELECT id FROM point_rules WHERE id=?').bind(id).first();
    if (!exists) return fail('Rule not found', 404);

    const sets = [];
    const binds = [];
    if (body.action !== undefined) { sets.push('action=?'); binds.push(String(body.action).trim()); }
    if (body.points !== undefined) {
      const p = parseInt(body.points, 10);
      if (!Number.isFinite(p)) return fail('Invalid points value');
      sets.push('points=?'); binds.push(p);
    }
    if (body.frequency !== undefined) { sets.push('frequency=?'); binds.push(String(body.frequency).trim() || null); }
    if (body.min_level !== undefined) { sets.push('min_level=?'); binds.push(String(body.min_level).trim() || 'All'); }
    if (body.active !== undefined) { sets.push('active=?'); binds.push(body.active ? 1 : 0); }
    if (body.sort_order !== undefined) { sets.push('sort_order=?'); binds.push(parseInt(body.sort_order, 10) || 0); }

    if (!sets.length) return fail('No fields to update');
    sets.push('updated_at=?');
    binds.push(now());
    binds.push(id);

    await env.DB.prepare(`UPDATE point_rules SET ${sets.join(',')} WHERE id=?`).bind(...binds).run();
    const row = await env.DB.prepare('SELECT * FROM point_rules WHERE id=?').bind(id).first();
    return json({ ok: true, rule: pickRule(row) });
  }

  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    await env.DB.prepare('DELETE FROM point_rules WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  return fail('Method not allowed', 405);
}
