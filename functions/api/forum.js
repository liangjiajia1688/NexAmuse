import { json, fail, now } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

// GET  /api/forum            → forum overview (stats + sections + recent + active members)
// POST /api/forum            → create a new thread (auth required, level-gated)
export async function onRequest(context) {
  const { request, env } = context;

  // ── GET: overview ─────────────────────────────────────────────
  if (request.method === 'GET') {
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
    const content = (body.content || '').trim();
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

  return fail('Method not allowed', 405);
}
