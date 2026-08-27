import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const id = params.id;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // GET — public single exhibition
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM exhibitions WHERE id = ?').bind(id).first();
    if (!row) return fail('Not found', 404);
    return json({ exhibition: row });
  }

  // Everything below requires an admin token.
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Unauthorized', 403);

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM exhibitions WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const existing = await env.DB.prepare('SELECT id FROM exhibitions WHERE id = ?').bind(id).first();
    if (!existing) return fail('Not found', 404);

    const startDate = (body.startDate || '').trim() || null;
    const endDate = (body.endDate || '').trim() || null;
    const status = (body.status || '').trim() || statusFor(startDate, endDate);

    await env.DB.prepare(
      `UPDATE exhibitions SET
        name=?, city=?, venue=?, country=?, startDate=?, endDate=?, status=?,
        category=?, region=?, flag=?, scale=?, description=?, url=?,
        featured=?, updated_at=?, date_source=?, needs_review=?
       WHERE id=?`
    ).bind(
      (body.name || '').trim(),
      (body.city || '').trim(),
      (body.venue || '').trim(),
      (body.country || '').trim(),
      startDate,
      endDate,
      status,
      (body.category || '').trim(),
      (body.region || '').trim(),
      (body.flag || '🌐').trim(),
      (body.scale || '').trim(),
      (body.description || '').trim(),
      (body.url || '').trim(),
      body.featured ? 1 : 0,
      now(),
      'manual',
      0,
      id
    ).run();
    return json({ ok: true, id });
  }

  return fail('Method not allowed', 405);
}

function statusFor(start, end) {
  if (!start) return 'pending';
  const t = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end || start).getTime() + 86400000;
  if (t > e) return 'ended';
  if (t >= s) return 'ongoing';
  return 'upcoming';
}
