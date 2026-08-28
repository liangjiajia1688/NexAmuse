import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const id = parseInt(context.params.id, 10);
  if (!id) return fail('Invalid id', 400);

  if (method === 'PUT' || method === 'DELETE') {
    const u = await authUser(request, env);
    if (!u || u.role !== 'admin') return fail('Unauthorized', 401);
  }

  if (method === 'PUT') {
    let b;
    try { b = await request.json(); } catch (e) { return fail('Invalid JSON', 400); }
    const fields = {};
    ['title', 'summary', 'url', 'source', 'image', 'category', 'status'].forEach(k => {
      if (b[k] !== undefined) fields[k] = (k === 'url' && !String(b[k]).trim()) ? null : b[k];
    });
    if (Object.keys(fields).length === 0) return fail('No fields to update', 400);
    const set = Object.keys(fields).map(k => k + ' = ?').join(', ');
    const binds = Object.values(fields);
    binds.push(id);
    await env.DB.prepare('UPDATE news SET ' + set + ' WHERE id = ?').bind(...binds).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    await env.DB.prepare('DELETE FROM news WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return fail('Method not allowed', 405);
}
