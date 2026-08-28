import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// GET /api/admin/analytics — aggregated visit stats by period.
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Admin access required', 401);

  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'today'; // today | yesterday | week | month
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const todayStart = Math.floor(now / day) * day;

  let start = todayStart;
  let end = now;
  if (period === 'yesterday') {
    start = todayStart - day;
    end = todayStart;
  } else if (period === 'week') {
    start = todayStart - 6 * day;
    end = now;
  } else if (period === 'month') {
    start = todayStart - 29 * day;
    end = now;
  }

  try {
    const tableExists = await env.DB.prepare(
      "SELECT 1 c FROM sqlite_master WHERE type='table' AND name='visits'"
    ).first();
    if (!tableExists) {
      return json({ ok: true, period, start, end, total: 0, unique: 0, bots: 0, sources: [], countries: [], devices: [], pages: [] }, 200);
    }

    const totalRow = await env.DB.prepare("SELECT COUNT(*) c FROM visits WHERE created_at >= ? AND created_at < ?").bind(start, end).first();
    const uniqueRow = await env.DB.prepare("SELECT COUNT(DISTINCT ip) c FROM visits WHERE created_at >= ? AND created_at < ?").bind(start, end).first();
    const botRow = await env.DB.prepare("SELECT COUNT(*) c FROM visits WHERE is_bot=1 AND created_at >= ? AND created_at < ?").bind(start, end).first();

    const sources = await env.DB.prepare(
      "SELECT source, COUNT(*) c FROM visits WHERE created_at >= ? AND created_at < ? GROUP BY source ORDER BY c DESC LIMIT 10"
    ).bind(start, end).all();
    const countries = await env.DB.prepare(
      "SELECT country, COUNT(*) c FROM visits WHERE created_at >= ? AND created_at < ? GROUP BY country ORDER BY c DESC LIMIT 10"
    ).bind(start, end).all();
    const devices = await env.DB.prepare(
      "SELECT device, COUNT(*) c FROM visits WHERE created_at >= ? AND created_at < ? GROUP BY device ORDER BY c DESC LIMIT 10"
    ).bind(start, end).all();
    const pages = await env.DB.prepare(
      "SELECT path, COUNT(*) c FROM visits WHERE created_at >= ? AND created_at < ? AND is_bot=0 GROUP BY path ORDER BY c DESC LIMIT 10"
    ).bind(start, end).all();

    return json({
      ok: true,
      period,
      start,
      end,
      total: totalRow.c || 0,
      unique: uniqueRow.c || 0,
      bots: botRow.c || 0,
      sources: sources.results || [],
      countries: countries.results || [],
      devices: devices.results || [],
      pages: pages.results || []
    }, 200);
  } catch (e) {
    return fail('DB error: ' + e.message, 500);
  }
}
