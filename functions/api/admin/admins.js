import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

// Return only the safe public fields of a user row.
function pick(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    avatar: u.avatar,
    role: u.role,
    level: u.level,
    status: u.status,
    is_super: u.is_super ? 1 : 0,
    points: u.points,
    created_at: u.created_at
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);

  if (request.method === 'OPTIONS') return json({ ok: true });

  // ── GET: list admin users + stats ───────────────────────────────
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      "SELECT * FROM users WHERE role='admin' OR is_super=1 ORDER BY is_super DESC, id ASC"
    ).all();
    const list = (rows.results || []).map(pick);
    const [total, superC, activeC, suspendedC] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' OR is_super=1").first(),
      env.DB.prepare('SELECT COUNT(*) c FROM users WHERE is_super=1').first(),
      env.DB.prepare("SELECT COUNT(*) c FROM users WHERE (role='admin' OR is_super=1) AND status='active'").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM users WHERE (role='admin' OR is_super=1) AND status IN ('suspended','banned')").first()
    ]);
    return json({
      ok: true,
      admins: list,
      stats: {
        total: total ? total.c : 0,
        super: superC ? superC.c : 0,
        active: activeC ? activeC.c : 0,
        suspended: suspendedC ? suspendedC.c : 0
      }
    });
  }

  // ── POST: create a new admin user ───────────────────────────────
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const email = (body.email || '').trim();
    if (!email) return fail('Email is required');
    const username = (body.username || email.split('@')[0]).trim();
    const role = (body.role === 'Super Admin') ? 'admin' : 'admin';
    const isSuper = body.role === 'Super Admin' ? 1 : 0;
    const status = (body.status === 'Suspended') ? 'suspended' : 'active';
    const exists = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
    if (exists) return fail('A user with this email already exists', 409);

    const res = await env.DB.prepare(
      "INSERT INTO users (email,username,password,role,is_super,status,level,points,created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).bind(email, username, 'pbkdf2$placeholder', role, isSuper, status, 'Standard', 0, now()).run();
    const row = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(res.meta.last_row_id).first();
    // Audit log
    await env.DB.prepare(
      'INSERT INTO admin_logs (admin_id,action,target_type,target_id,detail,ip,created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(user.id, 'admin_create', 'user', row.id, 'Created admin ' + email, request.headers.get('cf-connecting-ip') || '', now()).run();
    return json({ ok: true, admin: pick(row) }, 201);
  }

  // ── PUT: update role / status ───────────────────────────────────
  if (request.method === 'PUT') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const exists = await env.DB.prepare('SELECT id,is_super FROM users WHERE id=?').bind(id).first();
    if (!exists) return fail('User not found', 404);

    const sets = [];
    const binds = [];
    if (body.role !== undefined) {
      sets.push('is_super=?'); binds.push(body.role === 'Super Admin' ? 1 : 0);
      sets.push('role=?'); binds.push('admin');
    }
    if (body.status !== undefined) { sets.push('status=?'); binds.push(body.status === 'Suspended' ? 'suspended' : 'active'); }
    if (!sets.length) return fail('No fields to update');
    binds.push(id);
    await env.DB.prepare('UPDATE users SET ' + sets.join(',') + ' WHERE id=?').bind(...binds).run();
    const row = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    await env.DB.prepare(
      'INSERT INTO admin_logs (admin_id,action,target_type,target_id,detail,ip,created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(user.id, 'admin_update', 'user', id, 'Updated admin ' + id, request.headers.get('cf-connecting-ip') || '', now()).run();
    return json({ ok: true, admin: pick(row) });
  }

  // ── DELETE ──────────────────────────────────────────────────────
  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    if (id === user.id) return fail('You cannot remove yourself', 400);
    const row = await env.DB.prepare('SELECT is_super FROM users WHERE id=?').bind(id).first();
    if (!row) return fail('User not found', 404);
    if (row.is_super) return fail('Cannot remove a super admin', 400);
    await env.DB.prepare("UPDATE users SET role='user', is_super=0 WHERE id=?").bind(id).run();
    // Soft-demote instead of hard delete to preserve data integrity.
    await env.DB.prepare(
      'INSERT INTO admin_logs (admin_id,action,target_type,target_id,detail,ip,created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(user.id, 'admin_remove', 'user', id, 'Removed admin privileges from ' + id, request.headers.get('cf-connecting-ip') || '', now()).run();
    return json({ ok: true, message: 'Admin removed (demoted to member)' });
  }

  return fail('Method not allowed', 405);
}
