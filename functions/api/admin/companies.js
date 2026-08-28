import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

function isAdmin(user) {
  return user && (user.role === 'admin' || user.is_super);
}

function pickCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    slug: row.slug,
    country: row.country,
    city: row.city,
    contact_name: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website,
    logo: row.logo,
    primary_category: row.primary_category,
    description: row.description,
    established_year: row.established_year,
    company_size: row.company_size,
    certifications: row.certifications,
    status: row.status,
    featured: row.featured,
    views: row.views,
    products_count: row.products_count,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// GET  /api/admin/companies          → list all companies (admin only)
// PUT  /api/admin/companies?id=X     → update status/featured (admin only)
// DELETE /api/admin/companies?id=X   → delete company + products (admin only)
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!isAdmin(user)) return fail('Admin required', 403);

  if (request.method === 'GET') {
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let sql = 'SELECT * FROM companies WHERE 1=1';
    const binds = [];
    if (status) { sql += ' AND status=?'; binds.push(status); }
    if (q) { sql += ' AND (name LIKE ? OR email LIKE ? OR country LIKE ?)'; binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    binds.push(limit, offset);

    const result = binds.length
      ? await env.DB.prepare(sql).bind(...binds).all()
      : await env.DB.prepare(sql).all();

    let countSql = 'SELECT COUNT(*) c FROM companies WHERE 1=1';
    const countBinds = [];
    if (status) { countSql += ' AND status=?'; countBinds.push(status); }
    if (q) { countSql += ' AND (name LIKE ? OR email LIKE ? OR country LIKE ?)'; countBinds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const total = countBinds.length
      ? await env.DB.prepare(countSql).bind(...countBinds).first()
      : await env.DB.prepare(countSql).first();

    const pendingCount = await env.DB.prepare("SELECT COUNT(*) c FROM companies WHERE status='pending'").first();

    return json({
      ok: true,
      companies: (result.results || []).map(pickCompany),
      total: total.c || 0,
      pendingCount: pendingCount.c || 0
    });
  }

  if (request.method === 'PUT') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const sets = [];
    const binds = [];
    if (body.status !== undefined) { sets.push('status=?'); binds.push(body.status); }
    if (body.featured !== undefined) { sets.push('featured=?'); binds.push(body.featured ? 1 : 0); }
    if (body.name !== undefined) { sets.push('name=?'); binds.push(body.name.trim()); }
    if (body.country !== undefined) { sets.push('country=?'); binds.push(body.country.trim() || null); }
    if (body.primary_category !== undefined) { sets.push('primary_category=?'); binds.push(body.primary_category.trim() || null); }
    if (body.description !== undefined) { sets.push('description=?'); binds.push(body.description.trim() || null); }
    if (body.website !== undefined) { sets.push('website=?'); binds.push(body.website.trim() || null); }
    if (body.logo !== undefined) { sets.push('logo=?'); binds.push(body.logo.trim() || null); }
    if (!sets.length) return fail('No fields to update');

    sets.push('updated_at=?');
    binds.push(now());
    binds.push(id);

    await env.DB.prepare(`UPDATE companies SET ${sets.join(',')} WHERE id=?`).bind(...binds).run();
    const row = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(id).first();
    return json({ ok: true, company: pickCompany(row) });
  }

  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);

    await env.DB.prepare('DELETE FROM company_products WHERE company_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM companies WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Company and its products deleted' });
  }

  return fail('Method not allowed', 405);
}
