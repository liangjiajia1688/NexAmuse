import { json, fail, now } from '../_lib/db.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function pickAd(row) {
  return {
    id: row.id,
    title: row.title,
    client: row.client,
    zone: row.zone,
    slot: row.slot,
    size: row.size,
    image_url: row.image_url,
    link_url: row.link_url,
    alt_text: row.alt_text,
    html_code: row.html_code,
    emoji: row.emoji,
    impressions: row.impressions,
    clicks: row.clicks
  };
}

// GET  /api/ads?zone=homepage&limit=3  → active ads for a zone (public)
// POST /api/ads?id=1&type=impression   → record an impression / click (public)
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return json({ ok: true });

  if (request.method === 'GET') {
    const zone = url.searchParams.get('zone');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50);
    const today = todayStr();

    let sql = `SELECT * FROM ads
               WHERE status='active'
                 AND (start_date IS NULL OR date(start_date) <= ?)
                 AND (end_date IS NULL OR date(end_date) >= ?)`;
    const binds = [today, today];
    if (zone) { sql += ' AND zone=?'; binds.push(zone); }
    sql += ' ORDER BY priority DESC, created_at DESC LIMIT ?';
    binds.push(limit);

    const rows = await env.DB.prepare(sql).bind(...binds).all();
    return json({ ok: true, ads: (rows.results || []).map(pickAd) });
  }

  if (request.method === 'POST') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    const type = url.searchParams.get('type') === 'click' ? 'click' : 'impression';
    if (!id) return fail('Invalid id', 400);

    const ad = await env.DB.prepare('SELECT id FROM ads WHERE id=?').bind(id).first();
    if (!ad) return fail('Ad not found', 404);

    const day = todayStr();
    const col = type === 'click' ? 'clicks' : 'impressions';

    await env.DB.prepare(`UPDATE ads SET ${col} = ${col} + 1, updated_at=? WHERE id=?`).bind(now(), id).run();
    await env.DB.prepare(
      `INSERT INTO ads_daily (ad_id, day, impressions, clicks) VALUES (?,?,?,?)
       ON CONFLICT(ad_id, day) DO UPDATE SET ${col} = ${col} + 1`
    ).bind(id, day, type === 'impression' ? 1 : 0, type === 'click' ? 1 : 0).run();

    return json({ ok: true });
  }

  return fail('Method not allowed', 405);
}
