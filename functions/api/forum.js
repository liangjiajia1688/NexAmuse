import { json, fail, now } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';
import { sanitizeHtml } from '../_lib/sanitize.js';

// GET  /api/forum            → forum overview (stats + sections + recent + active members)
// POST /api/forum            → create a new thread (auth required, level-gated)
export async function onRequest(context) {
  const { request, env } = context;

  // ── GET: overview, or admin post list when ?manage=1 ──────────
  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.searchParams.get('manage') === '1') {
      const u = await authUser(request, env);
      if (!u || u.role !== 'admin') return fail('Unauthorized', 401);

      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const offset = (page - 1) * limit;
      const q = (url.searchParams.get('q') || '').trim();
      const section = (url.searchParams.get('section') || '').trim();
      const tab = url.searchParams.get('tab') || 'all';

      const where = [];
      const params = [];
      if (q) { where.push('(LOWER(t.title) LIKE ? OR LOWER(t.username) LIKE ?)'); params.push('%' + q.toLowerCase() + '%', '%' + q.toLowerCase() + '%'); }
      if (section) { where.push('s.name = ?'); params.push(section); }
      if (tab === 'pinned') where.push('t.pinned = 1');
      else if (tab === 'locked') where.push('t.locked = 1');
      else if (tab === 'reported') where.push('t.reported = 1');
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

      const countRes = await env.DB.prepare(
        `SELECT COUNT(*) c FROM forum_threads t LEFT JOIN forum_sections s ON t.section_id = s.id ${whereSql}`
      ).bind(...params).first();
      const total = countRes?.c || 0;

      const rows = await env.DB.prepare(
        `SELECT t.id, t.title, t.content, t.username, t.user_level, t.views, t.replies,
                t.pinned, t.locked, t.reported, t.status, t.created_at,
                COALESCE(s.name,'Uncategorized') AS section
         FROM forum_threads t LEFT JOIN forum_sections s ON t.section_id = s.id
         ${whereSql}
         ORDER BY t.pinned DESC, t.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all();

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const statAll = await env.DB.prepare('SELECT COUNT(*) c FROM forum_threads').first();
      const statToday = await env.DB.prepare('SELECT COUNT(*) c FROM forum_threads WHERE created_at >= ?').bind(todayStart.getTime()).first();
      const statReported = await env.DB.prepare('SELECT COUNT(*) c FROM forum_threads WHERE reported = 1').first();
      const statPinned = await env.DB.prepare('SELECT COUNT(*) c FROM forum_threads WHERE pinned = 1').first();

      const sectionsRes = await env.DB.prepare('SELECT name FROM forum_sections ORDER BY sort_order').all();

      return json({
        ok: true,
        posts: rows.results || [],
        total, page, limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        stats: {
          total: statAll?.c || 0,
          today: statToday?.c || 0,
          reported: statReported?.c || 0,
          pinned: statPinned?.c || 0
        },
        sections: (sectionsRes.results || []).map(s => s.name)
      });
    }

    const tCount = await env.DB.prepare('SELECT COUNT(*) c FROM forum_threads').first();
    const rCount = await env.DB.prepare('SELECT COUNT(*) c FROM forum_replies').first();
    const uCount = await env.DB.prepare("SELECT COUNT(*) c FROM users WHERE role='user'").first();

    const sectionsRes = await env.DB.prepare('SELECT * FROM forum_sections ORDER BY sort_order').all();
    const sections = sectionsRes.results;

    for (const s of sections) {
      const t = await env.DB.prepare(
        'SELECT COUNT(*) c, COALESCE(SUM(replies),0) r FROM forum_threads WHERE section_id=?'
      ).bind(s.id).first();
      s.threads = t.c || 0;
      s.replies = t.r || 0;
      const latest = await env.DB.prepare(
        'SELECT id,title,username,user_level,views,replies,pinned,created_at FROM forum_threads WHERE section_id=? ORDER BY created_at DESC LIMIT 4'
      ).bind(s.id).all();
      s.latestThreads = latest.results;
    }

    const recent = await env.DB.prepare(
      `SELECT t.id, t.title, t.username, t.user_level, t.created_at,
              s.name AS section, s.slug AS section_slug
       FROM forum_threads t JOIN forum_sections s ON t.section_id = s.id
       ORDER BY t.created_at DESC LIMIT 6`
    ).all();

    const active = await env.DB.prepare(
      `SELECT user_id, username, COUNT(*) AS posts FROM (
         SELECT user_id, username FROM forum_threads
         UNION ALL
         SELECT user_id, username FROM forum_replies
       ) GROUP BY user_id, username ORDER BY posts DESC LIMIT 5`
    ).all();

    return json({
      ok: true,
      stats: { threads: tCount.c || 0, replies: rCount.c || 0, members: uCount.c || 0 },
      sections,
      recentActivity: recent.results,
      activeMembers: active.results
    });
  }

  // ── POST: create thread ───────────────────────────────────────
  if (request.method === 'POST') {
    const user = await authUser(request, env);
    if (!user) return fail('Unauthorized', 401);
    if (user.status === 'banned') return fail('Account banned', 403);

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const title = (body.title || '').trim();
    const content = sanitizeHtml((body.content || '').trim());
    const slug = (body.section || '').trim().toLowerCase();

    if (!title || title.length < 5) return fail('Title too short (min 5 chars)');
    if (title.length > 100) return fail('Title too long (max 100 chars)');
    if (!content || content.length < 20) return fail('Content too short (min 20 chars)');

    const section = await env.DB.prepare('SELECT * FROM forum_sections WHERE slug=?').bind(slug).first();
    if (!section) return fail('Invalid forum section');

    // Buy/Sell is VIP-only to post
    const isAdmin = user.role === 'admin';
    if (slug === 'buy-sell' && user.level !== 'VIP' && !isAdmin) {
      return fail('The Buy/Sell section requires VIP membership to post', 403);
    }
    // Standard members: 1 thread per day (UTC day)
    if (user.level !== 'VIP' && user.level !== 'Premium' && !isAdmin) {
      const d = new Date();
      const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const cnt = await env.DB.prepare(
        'SELECT COUNT(*) c FROM forum_threads WHERE user_id=? AND created_at>=?'
      ).bind(user.id, dayStart).first();
      if ((cnt.c || 0) >= 1) return fail('Standard members can post 1 thread per day', 429);
    }

    const res = await env.DB.prepare(
      'INSERT INTO forum_threads (section_id,title,content,user_id,username,user_level,created_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(section.id, title, content, user.id, user.username, user.level || 'Standard', now()).run();

    await env.DB.prepare('UPDATE users SET points=points+1 WHERE id=?').bind(user.id).run();

    return json({ ok: true, id: res.meta.last_row_id, message: 'Thread posted' }, 201);
  }

  // ── PATCH: admin moderation (pin / lock / hide / delete) ───────
  if (request.method === 'PATCH') {
    const u = await authUser(request, env);
    if (!u || u.role !== 'admin') return fail('Unauthorized', 401);
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const id = parseInt(body.id, 10);
    if (!id) return fail('Post id required');

    if (body.action === 'delete') {
      await env.DB.prepare('DELETE FROM forum_replies WHERE thread_id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM forum_threads WHERE id=?').bind(id).run();
      return json({ ok: true, action: 'delete', id });
    }

    const sets = [];
    const params = [];
    if (body.pinned !== undefined) { sets.push('pinned=?'); params.push(body.pinned ? 1 : 0); }
    if (body.locked !== undefined) { sets.push('locked=?'); params.push(body.locked ? 1 : 0); }
    if (body.reported !== undefined) { sets.push('reported=?'); params.push(body.reported ? 1 : 0); }
    if (body.status) { sets.push('status=?'); params.push(body.status); }
    if (!sets.length) return fail('Nothing to update');
    params.push(id);
    await env.DB.prepare(`UPDATE forum_threads SET ${sets.join(',')} WHERE id=?`).bind(...params).run();
    return json({ ok: true, id });
  }

  return fail('Method not allowed', 405);
}
