import { json } from '../_lib/db.js';

// Public, read-only points leaderboard (top members by points).
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return json({ ok: true });

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const rows = await env.DB.prepare(
    "SELECT id, username, avatar, level, points, status FROM users WHERE role<>'admin' AND is_super=0 ORDER BY points DESC LIMIT ?"
  ).bind(limit).all();

  const ranked = (rows.results || []).map((u, i) => ({ rank: i + 1, ...u }));
  return json({ ok: true, leaderboard: ranked });
}
