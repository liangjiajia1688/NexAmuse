import { json, fail } from '../../_lib/db.js';
import { authUser, hashPassword } from '../../_lib/auth.js';

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

async function createMember(request, env) {
  let b;
  try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
  const email = String(b.email || '').trim();
  const username = String(b.username || '').trim();
  const password = String(b.password || '');
  if (!email || !username || !password) return fail('Email, username and password are required', 400);
  if (password.length < 8) return fail('Password must be at least 8 characters', 400);
  const exist = await env.DB.prepare('SELECT id FROM users WHERE email=? OR username=?').bind(email, username).first();
  if (exist) return fail('Email or username already exists', 409);
  const passwordHash = await hashPassword(password);
  const level = String(b.level || 'Standard').trim();
  const statusMap = { 'Active': 'active', 'Inactive': 'inactive', 'Pending Verification': 'unverified' };
  const status = statusMap[String(b.status || 'Active')] || 'active';
  const points = parseInt(b.points || '0', 10);
  const safePoints = Number.isFinite(points) ? points : 0;
  const s = (v) => String(v == null ? '' : v).trim();
  const res = await env.DB.prepare(
    `INSERT INTO users (email,username,password,role,level,points,status,is_super,created_at,first_name,last_name,phone,company,job_title,country,city,member_group)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    email, username, passwordHash, 'user', level, safePoints, status, 0, Date.now(),
    s(b.first_name), s(b.last_name), s(b.phone), s(b.company), s(b.job_title), s(b.country), s(b.city), s(b.member_group)
  ).run();
  return json({ ok: true, id: res?.meta?.last_row_id || null });
}

// Reuse the users table. `status` filter maps to verification state.
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);
  if (request.method !== 'GET') {
    if (request.method === 'POST') {
      return await createMember(request, env);
    }
    if (request.method === 'PUT') {
      const id = parseInt(url.searchParams.get('id') || '0', 10);
      if (!id) return fail('Invalid id', 400);
      let b; try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
      const f = []; const v = [];
      if (b.status !== undefined) { f.push('status=?'); v.push(String(b.status).trim()); }
      if (b.role !== undefined) { f.push('role=?'); v.push(String(b.role).trim()); }
      if (!f.length) return fail('No fields');
      v.push(id);
      await env.DB.prepare('UPDATE users SET ' + f.join(',') + ' WHERE id=?').bind(...v).run();
      return json({ ok: true });
    }
    return fail('Method not allowed', 405);
  }

  const status = url.searchParams.get('status') || '';
  const q = url.searchParams.get('q') || '';
  const where = [];
  const binds = [];
  if (status) { where.push('status=?'); binds.push(status); }
  if (q) { where.push('(email LIKE ? OR username LIKE ?)'); binds.push(`%${q}%`, `%${q}%`); }
  const sql = 'SELECT id,email,username,avatar,role,level,points,status,created_at FROM users'
    + (where.length ? ' WHERE ' + where.join(' AND ') : '')
    + ' ORDER BY created_at DESC LIMIT 200';

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  // quick stats across verification buckets
  const stats = await env.DB.prepare(
    `SELECT
       COUNT(*) total,
       SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active,
       SUM(CASE WHEN status IN ('pending','unverified') THEN 1 ELSE 0 END) unverified,
       SUM(CASE WHEN status IN ('suspended','banned') THEN 1 ELSE 0 END) suspended
     FROM users`
  ).first();

  return json({ ok: true, members: rows.results || [], stats: stats || {} });
}
