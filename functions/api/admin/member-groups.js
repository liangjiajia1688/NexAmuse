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

  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT g.*, (SELECT COUNT(*) FROM users u WHERE u.points>=g.min_points) members FROM member_groups g ORDER BY g.min_points ASC'
    ).all();
    return json({ ok: true, groups: rows.results || [] });
  }

  if (request.method === 'POST') {
    let b; try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const name = (b.name || '').trim();
    if (!name) return fail('Name is required');
    const res = await env.DB.prepare(
      'INSERT INTO member_groups (name,description,color,min_points,created_at) VALUES (?,?,?,?,?)'
    ).bind(name, (b.description || '').trim(), (b.color || '#94a3b8').trim(), parseInt(b.min_points) || 0, now()).run();
    const row = await env.DB.prepare('SELECT * FROM member_groups WHERE id=?').bind(res.meta.last_row_id).first();
    return json({ ok: true, group: row }, 201);
  }

  if (request.method === 'PUT') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    let b; try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const f = []; const v = [];
    ['name', 'description', 'color'].forEach(k => { if (b[k] !== undefined) { f.push(k + '=?'); v.push(String(b[k]).trim()); } });
    if (b.min_points !== undefined) { f.push('min_points=?'); v.push(parseInt(b.min_points) || 0); }
    if (!f.length) return fail('No fields');
    v.push(id);
    await env.DB.prepare('UPDATE member_groups SET ' + f.join(',') + ' WHERE id=?').bind(...v).run();
    const row = await env.DB.prepare('SELECT * FROM member_groups WHERE id=?').bind(id).first();
    return json({ ok: true, group: row });
  }

  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    await env.DB.prepare('DELETE FROM member_groups WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Group deleted' });
  }

  return fail('Method not allowed', 405);
}
