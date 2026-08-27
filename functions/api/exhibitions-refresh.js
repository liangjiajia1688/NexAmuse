import { json, fail, now } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';
import { SHOWS, TARGETED_SHOWS } from '../_lib/shows.js';

const TARGETED_NAMES = new Set(TARGETED_SHOWS.map(s => s.name));

function statusFor(start, end) {
  if (!start) return 'pending';
  const t = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end || start).getTime() + 86400000;
  if (t > e) return 'ended';
  if (t >= s) return 'ongoing';
  return 'upcoming';
}

async function upsert(env, s) {
  const existing = await env.DB.prepare('SELECT id, date_source, startDate FROM exhibitions WHERE name = ?').bind(s.name).first();
  const status = statusFor(s.startDate, s.endDate);
  const isTargeted = TARGETED_NAMES.has(s.name);
  const hasFixedDate = !!(s.startDate && s.endDate);
  // Targeted shows with operator-verified fixed dates are marked manual/verified.
  const dateSource = isTargeted ? (hasFixedDate ? 'manual' : 'scraped') : 'manual';
  const needsReview = isTargeted ? (hasFixedDate ? 0 : 1) : 0;

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO exhibitions (name,city,venue,country,startDate,endDate,status,category,region,flag,scale,description,url,featured,updated_at,date_source,needs_review)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      s.name, s.city || '', s.venue || '', s.country || '',
      s.startDate || null, s.endDate || null, status,
      s.category || '', s.region || '', s.flag || '🌐', s.scale || '',
      s.description || '', s.url || '', s.featured ? 1 : 0,
      now(), dateSource, needsReview
    ).run();
    return 'inserted';
  }

  // For targeted shows without a fixed date, keep any previously verified dates and only refresh metadata.
  if (isTargeted && !hasFixedDate) {
    await env.DB.prepare(
      `UPDATE exhibitions SET city=?, venue=?, country=?, category=?, region=?, flag=?, scale=?, description=?, url=?, featured=?, updated_at=? WHERE id=?`
    ).bind(
      s.city || '', s.venue || '', s.country || '', s.category || '', s.region || '',
      s.flag || '🌐', s.scale || '', s.description || '', s.url || '', s.featured ? 1 : 0,
      now(), existing.id
    ).run();
    return 'preserved';
  }

  // Otherwise refresh everything (curated shows, or targeted shows with fixed dates).
  await env.DB.prepare(
    `UPDATE exhibitions SET city=?, venue=?, country=?, startDate=?, endDate=?, status=?, category=?, region=?, flag=?, scale=?, description=?, url=?, featured=?, updated_at=?, date_source=?, needs_review=? WHERE id=?`
  ).bind(
    s.city || '', s.venue || '', s.country || '',
    s.startDate || null, s.endDate || null, status,
    s.category || '', s.region || '', s.flag || '🌐', s.scale || '',
    s.description || '', s.url || '', s.featured ? 1 : 0,
    now(), dateSource, needsReview,
    existing.id
  ).run();
  return 'updated';
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  const key = new URL(request.url).searchParams.get('key');
  const keyOk = !!(env.TOKEN_SECRET && key === env.TOKEN_SECRET);
  let adminOk = false;
  try {
    const u = await authUser(request, env);
    adminOk = !!(u && u.role === 'admin');
  } catch (e) {}
  if (!keyOk && !adminOk) return fail('Unauthorized', 401);

  const all = [...SHOWS, ...TARGETED_SHOWS];
  const summary = { inserted: 0, updated: 0, preserved: 0 };
  for (const s of all) {
    const r = await upsert(env, s);
    summary[r]++;
  }
  return json({ ok: true, summary, total: all.length });
}
