import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  // ── GET /api/news-categories ── public list (used by add/edit dropdowns)
  if (method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id, code, name, sort FROM news_categories ORDER BY sort ASC, id ASC'
    ).all();
    return json({ ok: true, categories: rows.results || [] });
  }

  // ── All mutations require admin ──
  const u = await authUser(request, env);
  if (!u || u.role !== 'admin') return fail('Unauthorized', 401);

  if (method === 'POST') {
    let b;
    try { b = await request.json(); } catch (e) { return fail('Invalid JSON', 400); }
    const code = (b.code || '').trim();
    if (!code) return fail('Category code required', 400);
    const res = await env.DB.prepare(
      'INSERT OR IGNORE INTO news_categories (code, name, sort) VALUES (?, ?, ?)'
    ).bind(code, (b.name || code).trim(), parseInt(b.sort || 0, 10) || 0).run();
    if (res.meta && res.meta.changes === 0) return fail('Code already exists', 409);
    return json({ ok: true, id: res.meta && res.meta.last_row_id });
  }

  if (method === 'PUT') {
    let b;
    try { b = await request.json(); } catch (e) { return fail('Invalid JSON', 400); }
    const id = parseInt(b.id, 10);
    if (!id) return fail('id required', 400);
    const fields = {};
    if (b.code !== undefined) fields.code = String(b.code).trim();
    if (b.name !== undefined) fields.name = String(b.name).trim();
    if (b.sort !== undefined) fields.sort = parseInt(b.sort, 10) || 0;
    if (Object.keys(fields).length === 0) return fail('No fields to update', 400);
    const set = Object.keys(fields).map(k => k + ' = ?').join(', ');
    const binds = Object.values(fields);
    binds.push(id);
    await env.DB.prepare('UPDATE news_categories SET ' + set + ' WHERE id = ?').bind(...binds).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    let b;
    try { b = await request.json(); } catch (e) { return fail('Invalid JSON', 400); }
    const id = parseInt(b.id, 10);
    if (!id) return fail('id required', 400);
    await env.DB.prepare('DELETE FROM news_categories WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return fail('Method not allowed', 405);
}
