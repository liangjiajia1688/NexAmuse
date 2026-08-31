import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

function pickAd(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    client: row.client,
    zone: row.zone,
    slot: row.slot,
    size: row.size,
    status: row.status,
    image_url: row.image_url,
    link_url: row.link_url,
    alt_text: row.alt_text,
    html_code: row.html_code,
    emoji: row.emoji,
    start_date: row.start_date,
    end_date: row.end_date,
    pricing_model: row.pricing_model,
    unit_price: row.unit_price,
    budget: row.budget,
    spent: row.spent,
    impressions: row.impressions,
    clicks: row.clicks,
    priority: row.priority,
    target_audience: row.target_audience,
    region: row.region,
    frequency: row.frequency,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dayStr(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);

  if (request.method === 'OPTIONS') return json({ ok: true });

  // ── GET: list (+ optional stats) ────────────────────────────
  if (request.method === 'GET') {
    const zone = url.searchParams.get('zone');
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q');
    const withStats = url.searchParams.get('stats') === '1';
    const days = Math.min(parseInt(url.searchParams.get('days') || '7', 10), 90);

    // Lazily expire ads whose end date has passed.
    await env.DB.prepare(
      "UPDATE ads SET status='expired', updated_at=? WHERE status IN ('active','paused') AND end_date IS NOT NULL AND end_date < ?"
    ).bind(now(), todayStr()).run();

    let where = '1=1';
    const binds = [];
    if (zone) { where += ' AND zone=?'; binds.push(zone); }
    if (status) { where += ' AND status=?'; binds.push(status); }
    if (q) { where += ' AND (title LIKE ? OR client LIKE ?)'; binds.push(`%${q}%`, `%${q}%`); }

    const rows = await env.DB.prepare(
      `SELECT * FROM ads WHERE ${where} ORDER BY priority DESC, created_at DESC`
    ).bind(...binds).all();
    const ads = (rows.results || []).map(pickAd);

    const response = { ok: true, ads };

    if (withStats) {
      const [total, active, paused, expired, pending, agg] = await Promise.all([
        env.DB.prepare('SELECT COUNT(*) c FROM ads').first(),
        env.DB.prepare("SELECT COUNT(*) c FROM ads WHERE status='active'").first(),
        env.DB.prepare("SELECT COUNT(*) c FROM ads WHERE status='paused'").first(),
        env.DB.prepare("SELECT COUNT(*) c FROM ads WHERE status='expired'").first(),
        env.DB.prepare("SELECT COUNT(*) c FROM ads WHERE status='pending'").first(),
        env.DB.prepare('SELECT COALESCE(SUM(impressions),0) imp, COALESCE(SUM(clicks),0) clk, COALESCE(SUM(spent),0) rev FROM ads').first()
      ]);

      const startDay = dayStr(-(days - 1));
      const prevStart = dayStr(-(days * 2 - 1));
      const prevEnd = dayStr(-days);
      const [dailyRows, zoneRows, perfRows, prevRow] = await Promise.all([
        env.DB.prepare(
          'SELECT day, SUM(impressions) imp, SUM(clicks) clk FROM ads_daily WHERE day >= ? GROUP BY day ORDER BY day ASC'
        ).bind(startDay).all(),
        env.DB.prepare(
          `SELECT a.zone zone, COALESCE(SUM(d.impressions),0) imp
           FROM ads_daily d JOIN ads a ON a.id = d.ad_id
           WHERE d.day >= ? GROUP BY a.zone ORDER BY imp DESC`
        ).bind(startDay).all(),
        env.DB.prepare('SELECT id, title, zone, impressions, clicks, budget, spent, status FROM ads ORDER BY impressions DESC').all(),
        env.DB.prepare(
          'SELECT COALESCE(SUM(impressions),0) imp, COALESCE(SUM(clicks),0) clk FROM ads_daily WHERE day >= ? AND day <= ?'
        ).bind(prevStart, prevEnd).first()
      ]);

      // Fill any missing days with zeros so charts stay continuous.
      const dailyMap = {};
      (dailyRows.results || []).forEach(r => { dailyMap[r.day] = r; });
      const daily = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = dayStr(-i);
        const r = dailyMap[d];
        daily.push({ day: d, impressions: r ? r.imp : 0, clicks: r ? r.clk : 0 });
      }

      const totalImp = agg ? agg.imp : 0;
      const totalClk = agg ? agg.clk : 0;
      const zoneList = zoneRows.results || [];
      const zoneTotal = zoneList.reduce((s, z) => s + z.imp, 0);

      response.stats = {
        total: total ? total.c : 0,
        active: active ? active.c : 0,
        paused: paused ? paused.c : 0,
        expired: expired ? expired.c : 0,
        pending: pending ? pending.c : 0,
        impressions: totalImp,
        clicks: totalClk,
        revenue: agg ? Math.round(agg.rev) : 0,
        ctr: totalImp > 0 ? Number(((totalClk / totalImp) * 100).toFixed(2)) : 0,
        prev: {
          impressions: prevRow ? prevRow.imp : 0,
          clicks: prevRow ? prevRow.clk : 0
        },
        daily,
        zones: zoneList.map(z => ({
          zone: z.zone,
          impressions: z.imp,
          pct: zoneTotal > 0 ? Math.round((z.imp / zoneTotal) * 100) : 0
        })),
        perAd: (perfRows.results || []).map(r => ({
          id: r.id,
          title: r.title,
          zone: r.zone,
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: r.impressions > 0 ? Number(((r.clicks / r.impressions) * 100).toFixed(2)) : 0,
          budget: r.budget,
          spent: r.spent,
          status: r.status
        }))
      };
    }

    return json(response);
  }

  // ── POST: create ────────────────────────────────────────────
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const title = (body.title || '').trim();
    if (!title) return fail('Ad title is required');

    const client = (body.client || '').trim() || null;
    const zone = (body.zone || 'homepage').trim();
    const slot = (body.slot || '').trim() || null;
    const size = (body.size || '').trim() || null;
    const status = (body.status || 'pending').trim();
    const image_url = (body.image_url || '').trim() || null;
    const link_url = (body.link_url || '').trim() || null;
    const alt_text = (body.alt_text || '').trim() || null;
    const html_code = (body.html_code || '').trim() || null;
    const emoji = (body.emoji || '').trim() || null;
    const start_date = (body.start_date || '').trim() || null;
    const end_date = (body.end_date || '').trim() || null;
    const pricing_model = (body.pricing_model || 'CPM').trim();
    const unit_price = Number(body.unit_price) || 0;
    const budget = Number(body.budget) || 0;
    const priority = Number(body.priority) || 2;
    const target_audience = (body.target_audience || 'all').trim();
    const region = (body.region || 'all').trim();
    const frequency = (body.frequency || 'always').trim();
    const notes = (body.notes || '').trim() || null;

    const ts = now();
    const res = await env.DB.prepare(
      `INSERT INTO ads (title,client,zone,slot,size,status,image_url,link_url,alt_text,html_code,emoji,
        start_date,end_date,pricing_model,unit_price,budget,spent,impressions,clicks,priority,
        target_audience,region,frequency,notes,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,?,?,?,?,?,?,?)`
    ).bind(
      title, client, zone, slot, size, status, image_url, link_url, alt_text, html_code, emoji,
      start_date, end_date, pricing_model, unit_price, budget, priority,
      target_audience, region, frequency, notes, ts, ts
    ).run();

    const row = await env.DB.prepare('SELECT * FROM ads WHERE id=?').bind(res.meta.last_row_id).first();
    return json({ ok: true, ad: pickAd(row) }, 201);
  }

  // ── PUT: update ─────────────────────────────────────────────
  if (request.method === 'PUT') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const exists = await env.DB.prepare('SELECT id FROM ads WHERE id=?').bind(id).first();
    if (!exists) return fail('Ad not found', 404);

    const fields = {
      title: 'title', client: 'client', zone: 'zone', slot: 'slot', size: 'size', status: 'status',
      image_url: 'image_url', link_url: 'link_url', alt_text: 'alt_text', html_code: 'html_code',
      emoji: 'emoji', start_date: 'start_date', end_date: 'end_date', pricing_model: 'pricing_model',
      target_audience: 'target_audience', region: 'region', frequency: 'frequency', notes: 'notes'
    };
    const numFields = { unit_price: 'unit_price', budget: 'budget', spent: 'spent', priority: 'priority' };

    const sets = [];
    const binds = [];
    Object.entries(fields).forEach(([key, col]) => {
      if (body[key] !== undefined) { sets.push(`${col}=?`); binds.push(String(body[key]).trim() || null); }
    });
    Object.entries(numFields).forEach(([key, col]) => {
      if (body[key] !== undefined) { sets.push(`${col}=?`); binds.push(Number(body[key]) || 0); }
    });

    if (!sets.length) return fail('No fields to update');

    sets.push('updated_at=?');
    binds.push(now());
    binds.push(id);

    await env.DB.prepare(`UPDATE ads SET ${sets.join(',')} WHERE id=?`).bind(...binds).run();
    const row = await env.DB.prepare('SELECT * FROM ads WHERE id=?').bind(id).first();
    return json({ ok: true, ad: pickAd(row) });
  }

  // ── DELETE ──────────────────────────────────────────────────
  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    await env.DB.prepare('DELETE FROM ads_daily WHERE ad_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM ads WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Ad deleted' });
  }

  return fail('Method not allowed', 405);
}
