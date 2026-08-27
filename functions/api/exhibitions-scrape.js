import { json, fail, now } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';
import { scrapeShowDates } from '../_lib/expo-scraper.js';
import { TARGETED_SHOWS } from '../_lib/shows.js';

function statusFor(start, end) {
  const t = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end || start).getTime() + 86400000;
  if (t > e) return 'ended';
  if (t >= s) return 'ongoing';
  return 'upcoming';
}

async function verifyOne(env, s, refYear) {
  let scrape = { ok: false, reason: 'no url', confidence: 0 };
  if (s.url) {
    scrape = await scrapeShowDates(s.url, { refYear, timeout: 9000 });
  }

  const existing = await env.DB.prepare('SELECT id, startDate, date_source FROM exhibitions WHERE name = ?').bind(s.name).first();
  if (!existing) {
    // Should not happen (refresh upserts first), but create it if missing.
    const status = scrape.ok ? statusFor(scrape.startDate, scrape.endDate) : 'pending';
    await env.DB.prepare(
      `INSERT INTO exhibitions (name,city,venue,country,startDate,endDate,status,category,region,flag,scale,description,url,featured,updated_at,date_source,needs_review,last_verified,scrape_note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      s.name, s.city || '', s.venue || '', s.country || '',
      scrape.ok ? scrape.startDate : null, scrape.ok ? scrape.endDate : null, status,
      s.category || '', s.region || '', s.flag || '🌐', s.scale || '', s.description || '', s.url || '',
      s.featured ? 1 : 0, now(), scrape.ok ? 'scraped' : 'manual', scrape.ok ? (scrape.confidence < 2 ? 1 : 0) : 1,
      now(), scrape.ok ? ('scraped y' + scrape.year) : scrape.reason
    ).run();
    return { name: s.name, url: s.url, scraped: scrape.ok, note: scrape.ok ? 'inserted' : scrape.reason };
  }

  if (scrape.ok) {
    const status = statusFor(scrape.startDate, scrape.endDate);
    await env.DB.prepare(
      `UPDATE exhibitions SET startDate=?, endDate=?, status=?, date_source=?, needs_review=?, last_verified=?, scrape_note=?, updated_at=? WHERE id=?`
    ).bind(
      scrape.startDate, scrape.endDate, status, 'scraped',
      scrape.confidence < 2 ? 1 : 0, now(),
      'scraped y' + scrape.year + ' conf' + scrape.confidence, now(), existing.id
    ).run();
    return { name: s.name, url: s.url, scraped: true, startDate: scrape.startDate, endDate: scrape.endDate, confidence: scrape.confidence };
  }

  // Could not verify — keep existing dates, flag for human review.
  await env.DB.prepare(
    `UPDATE exhibitions SET needs_review=1, last_verified=?, scrape_note=?, updated_at=? WHERE id=?`
  ).bind(now(), scrape.reason || 'scrape failed', now(), existing.id).run();
  return { name: s.name, url: s.url, scraped: false, note: scrape.reason || 'scrape failed', kept: existing.startDate };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  const url = new URL(request.url);
  const keyOk = !!(env.TOKEN_SECRET && url.searchParams.get('key') === env.TOKEN_SECRET);
  const cronOk = request.headers.get('X-Cron-Auth') === env.TOKEN_SECRET;
  let adminOk = false;
  try {
    const u = await authUser(request, env);
    adminOk = !!(u && u.role === 'admin');
  } catch (e) {}
  if (!keyOk && !adminOk && !cronOk) return fail('Unauthorized', 401);

  const refYear = new Date().getFullYear();
  const results = await Promise.allSettled(TARGETED_SHOWS.map(s => verifyOne(env, s, refYear)));
  const out = results.map(r => r.status === 'fulfilled' ? r.value : { error: String(r.reason) });
  const verified = out.filter(r => r.scraped).length;
  const failed = out.length - verified;
  return json({ ok: true, refYear, verified, needsReview: failed, results: out });
}
