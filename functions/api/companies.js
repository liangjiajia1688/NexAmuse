import { json, fail, now } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';
import { canCreateCompanyPage } from '../_lib/permissions.js';

function slugify(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(base, ownerId) {
  return `${base}-${ownerId}`;
}

const CATEGORY_SLUGS = {
  arcade: 'Arcade Machines',
  vr: 'VR / XR Attractions',
  kids: 'Kids & Family Rides',
  redemption: 'Redemption Games',
  simulation: 'Simulation Rides',
  outdoor: 'Outdoor Attractions',
  waterpark: 'Water Park Equipment',
  payment: 'Payment Technology',
  accessories: 'Accessories & Parts'
};

function resolveCategories(slugs) {
  return slugs.map(s => CATEGORY_SLUGS[s] || s).filter(Boolean);
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

// GET  /api/companies            → list public approved companies
// GET  /api/companies?mine=1     → authenticated user's company
// POST /api/companies            → create/update authenticated user's company
// DELETE /api/companies?id=X     → delete own company (or admin any)
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    // My company
    if (url.searchParams.get('mine') === '1') {
      const user = await authUser(request, env);
      if (!user) return fail('Unauthorized', 401);
      const row = await env.DB.prepare('SELECT * FROM companies WHERE owner_id=?').bind(user.id).first();
      return json({ ok: true, company: pickCompany(row) });
    }

    // Public list
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const cat = url.searchParams.get('cat');
    const country = url.searchParams.get('country');
    const q = url.searchParams.get('q');
    const sort = url.searchParams.get('sort') || 'featured';
    const withStats = url.searchParams.get('stats') === '1';

    const rawCats = cat ? cat.split(',').map(s => s.trim()).filter(Boolean) : [];
    const cats = resolveCategories(rawCats);
    const countries = country ? country.split(',').map(s => s.trim()).filter(Boolean) : [];

    let where = "status='approved'";
    const binds = [];
    if (cats.length) {
      where += ` AND primary_category IN (${cats.map(() => '?').join(',')})`;
      binds.push(...cats);
    }
    if (countries.length) {
      where += ` AND country IN (${countries.map(() => '?').join(',')})`;
      binds.push(...countries);
    }
    if (q) { where += " AND (name LIKE ? OR description LIKE ?)"; binds.push(`%${q}%`, `%${q}%`); }

    const orderBy = {
      featured: 'featured DESC, created_at DESC',
      name: 'name ASC',
      products: 'products_count DESC, created_at DESC',
      newest: 'created_at DESC',
      views: 'views DESC, created_at DESC'
    }[sort] || 'featured DESC, created_at DESC';

    const listSql = `SELECT * FROM companies WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const listBinds = [...binds, limit, offset];
    const result = await env.DB.prepare(listSql).bind(...listBinds).all();

    const countSql = `SELECT COUNT(*) c FROM companies WHERE ${where}`;
    const totalRow = await env.DB.prepare(countSql).bind(...binds).first();
    const total = totalRow ? totalRow.c : 0;

    const response = { ok: true, companies: (result.results || []).map(pickCompany), total, limit, offset };

    if (withStats) {
      const [countryRows, catRows] = await Promise.all([
        env.DB.prepare("SELECT country, COUNT(*) c FROM companies WHERE status='approved' GROUP BY country ORDER BY c DESC, country ASC").all(),
        env.DB.prepare("SELECT primary_category, COUNT(*) c FROM companies WHERE status='approved' GROUP BY primary_category ORDER BY c DESC, primary_category ASC").all()
      ]);
      response.countries = (countryRows.results || [])
        .filter(r => r.country)
        .map(r => ({ name: r.country, count: r.c }));
      response.categories = (catRows.results || [])
        .filter(r => r.primary_category)
        .map(r => ({ name: r.primary_category, count: r.c }));
    }

    return json(response);
  }

  if (request.method === 'POST') {
    const user = await authUser(request, env);
    if (!user) return fail('Unauthorized', 401);
    if (user.status === 'banned') return fail('Account banned', 403);
    if (!canCreateCompanyPage(user)) {
      return fail('Company profiles require Premium or VIP membership', 403);
    }

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const name = (body.name || '').trim();
    if (!name || name.length < 2) return fail('Company name too short');
    if (name.length > 120) return fail('Company name too long (max 120)');

    const country = (body.country || '').trim() || null;
    if (!country) return fail('Country is required');
    const contact_name = (body.contact_name || '').trim() || null;
    if (!contact_name) return fail('Contact name is required');
    const email = (body.email || '').trim() || null;
    if (!email) return fail('Business email is required');
    const primary_category = (body.primary_category || '').trim() || null;
    if (!primary_category) return fail('Primary product category is required');

    const description = (body.description || '').trim();
    if (description.length > 2000) return fail('Description too long (max 2000)');

    const city = (body.city || '').trim() || null;
    const phone = (body.phone || '').trim() || null;
    const website = (body.website || '').trim() || null;
    const logo = (body.logo || '').trim() || null;
    const established_year = body.established_year ? parseInt(body.established_year, 10) : null;
    const company_size = (body.company_size || '').trim() || null;
    const certifications = (body.certifications || '').trim() || null;
    const updated_at = now();

    const existing = await env.DB.prepare('SELECT id FROM companies WHERE owner_id=?').bind(user.id).first();

    if (existing) {
      // Update; keep original slug so external links don't break
      await env.DB.prepare(
        `UPDATE companies SET name=?, country=?, city=?, contact_name=?, email=?, phone=?, website=?, logo=?,
         primary_category=?, description=?, established_year=?, company_size=?, certifications=?, updated_at=?
         WHERE id=?`
      ).bind(name, country, city, contact_name, email, phone, website, logo, primary_category, description,
             established_year, company_size, certifications, updated_at, existing.id).run();

      const row = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(existing.id).first();
      return json({ ok: true, company: pickCompany(row), message: 'Company profile updated' });
    }

    // Create new - pending until admin approves
    const base = slugify(name);
    const slug = uniqueSlug(base, user.id);
    const res = await env.DB.prepare(
      `INSERT INTO companies (owner_id,name,slug,country,city,contact_name,email,phone,website,logo,
        primary_category,description,established_year,company_size,certifications,status,featured,views,products_count,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(user.id, name, slug, country, city, contact_name, email, phone, website, logo,
           primary_category, description, established_year, company_size, certifications,
           'pending', 0, 0, 0, updated_at, updated_at).run();

    const row = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(res.meta.last_row_id).first();
    return json({ ok: true, company: pickCompany(row), message: 'Company profile submitted for review' }, 201);
  }

  if (request.method === 'DELETE') {
    const user = await authUser(request, env);
    if (!user) return fail('Unauthorized', 401);
    const isAdmin = user.role === 'admin' || user.is_super;
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);

    const company = await env.DB.prepare('SELECT owner_id FROM companies WHERE id=?').bind(id).first();
    if (!company) return fail('Company not found', 404);
    if (!isAdmin && company.owner_id !== user.id) return fail('Forbidden', 403);

    await env.DB.prepare('DELETE FROM company_products WHERE company_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM companies WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Company deleted' });
  }

  return fail('Method not allowed', 405);
}
