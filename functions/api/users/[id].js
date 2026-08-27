import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Unauthorized', 403);

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return fail('Invalid id', 400);

  // DELETE — remove a user
  if (request.method === 'DELETE') {
    if (id === user.id) return fail('Cannot delete your own account');
    await env.DB.prepare('DELETE FROM users WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  // PUT — update role / email / level / points / status
  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const email = (body.email || '').trim().toLowerCase();
    const role = (body.role || '').trim();
    const level = (body.level || '').trim();
    const status = (body.status || '').trim();
    const pointsRaw = body.points;

    if (role && role !== 'user' && role !== 'admin') return fail('Invalid role');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Invalid email');
    const LEVELS = ['Platinum', 'Gold', 'Silver', 'Standard'];
    if (level && !LEVELS.includes(level)) return fail('Invalid level');
    const STATUSES = ['active', 'inactive', 'banned'];
    if (status && !STATUSES.includes(status)) return fail('Invalid status');
    let points = null;
    if (pointsRaw !== undefined && pointsRaw !== null && pointsRaw !== '') {
      points = parseInt(pointsRaw, 10);
      if (!Number.isFinite(points) || points < 0) return fail('Invalid points');
    }

    // 最高管理员 (super admin) exclusive fields: level / points / status.
    if ((level || status || points !== null) && user.is_super !== 1) {
      return fail('Only Super Admin can modify member level / status / points', 403);
    }

    const sets = [];
    const binds = [];
    if (role) { sets.push('role=?'); binds.push(role); }
    if (email) {
      const clash = await env.DB.prepare('SELECT id FROM users WHERE email=? AND id!=?').bind(email, id).first();
      if (clash) return fail('Email already in use', 409);
      sets.push('email=?'); binds.push(email);
    }
    if (level) { sets.push('level=?'); binds.push(level); }
    if (status) { sets.push('status=?'); binds.push(status); }
    if (points !== null) { sets.push('points=?'); binds.push(points); }

    if (sets.length) {
      binds.push(id);
      await env.DB.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id=?').bind(...binds).run();
    }
    const row = await env.DB.prepare('SELECT id,email,username,role,avatar,level,points,status,created_at FROM users WHERE id=?').bind(id).first();
    return json({ user: row });
  }

  return fail('Method not allowed', 405);
}
