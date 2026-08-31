import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);
  if (request.method === 'OPTIONS') return json({ ok: true });

  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT s.*, (SELECT COUNT(*) FROM forum_threads t WHERE t.section_id=s.id) threads, (SELECT COUNT(*) FROM forum_replies r JOIN forum_threads t2 ON t2.id=r.thread_id WHERE t2.section_id=s.id) replies FROM forum_sections s ORDER BY s.sort_order ASC'
    ).all();
    return json({ ok: true, sections: rows.results || [] });
  }

  if (request.method === 'POST') {
    let b; try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const name = (b.name || '').trim();
    if (!name) return fail('Name is required');
    const slug = (b.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
    const res = await env.DB.prepare(
      'INSERT INTO forum_sections (name,slug,description,icon,sort_order,status,post_permission) VALUES (?,?,?,?,?,?,?)'
    ).bind(
      name, slug, (b.description || '').trim(), (b.icon || '📁').trim(),
      parseInt(b.sort_order) || 99,
      (b.status || 'active').trim(),
      (b.perm || b.post_permission || 'all').trim()
    ).run();
    const row = await env.DB.prepare('SELECT * FROM forum_sections WHERE id=?').bind(res.meta.last_row_id).first();
    return json({ ok: true, section: row }, 201);
  }

  if (request.method === 'PUT') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    let b; try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const f = []; const v = [];
    ['name', 'slug', 'description', 'icon', 'status'].forEach(k => { if (b[k] !== undefined) { f.push(k + '=?'); v.push(String(b[k]).trim()); } });
    if (b.perm !== undefined || b.post_permission !== undefined) { f.push('post_permission=?'); v.push(String(b.perm !== undefined ? b.perm : b.post_permission).trim()); }
    if (b.sort_order !== undefined) { f.push('sort_order=?'); v.push(parseInt(b.sort_order) || 99); }
    if (!f.length) return fail('No fields');
    v.push(id);
    await env.DB.prepare('UPDATE forum_sections SET ' + f.join(',') + ' WHERE id=?').bind(...v).run();
    const row = await env.DB.prepare('SELECT * FROM forum_sections WHERE id=?').bind(id).first();
    return json({ ok: true, section: row });
  }

  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);
    await env.DB.prepare('DELETE FROM forum_sections WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Section deleted' });
  }

  return fail('Method not allowed', 405);
}
