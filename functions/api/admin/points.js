import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

const LEVELS = ['Standard', 'Premium', 'VIP'];

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

function pickUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatar: row.avatar,
    role: row.role,
    level: row.level || 'Standard',
    points: row.points || 0,
    status: row.status || 'active',
    created_at: row.created_at
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);

  if (request.method === 'OPTIONS') return json({ ok: true });

  // ── GET: members + level stats + recent ledger ──────────────
  if (request.method === 'GET') {
    const level = (url.searchParams.get('level') || '').trim();
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const sort = url.searchParams.get('sort') || 'points';

    let where = '1=1';
    const binds = [];
    if (level && LEVELS.includes(level)) { where += ' AND COALESCE(level,"Standard")=?'; binds.push(level); }
    if (q) { where += ' AND (email LIKE ? OR username LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }

    const orderBy = {
      points: 'points DESC, id DESC',
      newest: 'created_at DESC, id DESC',
      name: 'username ASC'
    }[sort] || 'points DESC, id DESC';

    const rows = await env.DB.prepare(
      `SELECT id,email,username,avatar,role,level,points,status,created_at
       FROM users WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();

    const totalRow = await env.DB.prepare(`SELECT COUNT(*) c FROM users WHERE ${where}`).bind(...binds).first();

    const [totalMembers, stdCount, preCount, vipCount, pointsSum] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) c FROM users').first(),
      env.DB.prepare("SELECT COUNT(*) c FROM users WHERE COALESCE(level,'Standard')='Standard'").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM users WHERE level='Premium'").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM users WHERE level='VIP'").first(),
      env.DB.prepare('SELECT COALESCE(SUM(points),0) s FROM users').first()
    ]);

    const logRows = await env.DB.prepare(
      `SELECT l.id, l.user_id, l.delta, l.balance, l.action, l.reason, l.admin_id, l.created_at,
              u.username, u.email
       FROM point_logs l LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC LIMIT 20`
    ).all();

    return json({
      ok: true,
      members: (rows.results || []).map(pickUser),
      total: totalRow ? totalRow.c : 0,
      limit,
      offset,
      stats: {
        total: totalMembers ? totalMembers.c : 0,
        standard: stdCount ? stdCount.c : 0,
        premium: preCount ? preCount.c : 0,
        vip: vipCount ? vipCount.c : 0,
        points: pointsSum ? pointsSum.s : 0
      },
      logs: (logRows.results || []).map(r => ({
        id: r.id,
        user_id: r.user_id,
        delta: r.delta,
        balance: r.balance,
        action: r.action,
        reason: r.reason,
        admin_id: r.admin_id,
        created_at: r.created_at,
        username: r.username,
        email: r.email
      }))
    });
  }

  // ── POST: adjust points ─────────────────────────────────────
  // body: { email | user_id, op: 'add'|'deduct'|'set', points, reason, action }
  if (request.method === 'POST') {
    if (user.is_super !== 1) {
      return fail('Only Super Admin can modify member points', 403);
    }

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const op = (body.op || 'add').trim();
    const amount = parseInt(body.points, 10);
    if (!Number.isFinite(amount) || amount < 0) return fail('Invalid points value');
    const reason = (body.reason || '').trim() || null;
    const ts0 = now();

    // ── Bulk mode: apply to every member of a level (or all members) ──
    if (body.bulk) {
      const level = (body.level || '').trim();
      if (level && !LEVELS.includes(level)) return fail('Invalid level');

      const sql = level
        ? "SELECT id, points FROM users WHERE COALESCE(level,'Standard')=?"
        : 'SELECT id, points FROM users';
      const rows = level
        ? await env.DB.prepare(sql).bind(level).all()
        : await env.DB.prepare(sql).all();

      const targets = rows.results || [];
      let affected = 0;
      for (const t of targets) {
        const cur = t.points || 0;
        const next = op === 'set' ? amount : op === 'deduct' ? Math.max(0, cur - amount) : cur + amount;
        const delta = next - cur;
        await env.DB.prepare('UPDATE users SET points=? WHERE id=?').bind(next, t.id).run();
        await env.DB.prepare(
          `INSERT INTO point_logs (user_id, delta, balance, action, reason, admin_id, created_at)
           VALUES (?,?,?,?,?,?,?)`
        ).bind(t.id, delta, next, 'bulk_adjust', reason, user.id, ts0).run();
        affected++;
      }
      return json({ ok: true, affected, message: `${op} ${amount} points applied to ${affected} members` });
    }

    let row = null;
    if (body.user_id) {
      row = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(parseInt(body.user_id, 10)).first();
    } else if (body.email) {
      row = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(String(body.email).trim().toLowerCase()).first();
    }
    if (!row) return fail('Member not found', 404);

    const current = row.points || 0;
    let next;
    if (op === 'set') next = amount;
    else if (op === 'deduct') next = Math.max(0, current - amount);
    else next = current + amount;

    const delta = next - current;
    const ts = now();

    await env.DB.prepare('UPDATE users SET points=? WHERE id=?').bind(next, row.id).run();
    await env.DB.prepare(
      `INSERT INTO point_logs (user_id, delta, balance, action, reason, admin_id, created_at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(row.id, delta, next, (body.action || 'admin_adjust').trim(), (body.reason || '').trim() || null, user.id, ts).run();

    return json({
      ok: true,
      user: pickUser({ ...row, points: next }),
      delta,
      balance: next,
      message: delta >= 0 ? `+${delta} points applied` : `${delta} points applied`
    });
  }

  return fail('Method not allowed', 405);
}
