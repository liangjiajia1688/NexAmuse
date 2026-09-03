import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

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
    banner: row.banner,
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

function pickProduct(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    description: row.description,
    price: row.price,
    moq: row.moq,
    image: row.image,
    status: row.status,
    featured: row.featured,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// GET /api/companies/:slug → public company detail + products
export async function onRequest(context) {
  const { request, env, params } = context;
  const slug = (params.slug || '').trim();
  if (!slug) return fail('Invalid slug', 400);

  const user = await authUser(request, env);
  const isAdmin = user && (user.role === 'admin' || user.is_super);

  const company = await env.DB.prepare('SELECT * FROM companies WHERE slug=?').bind(slug).first();
  if (!company) return fail('Company not found', 404);
  if (company.status !== 'approved' && !isAdmin && (!user || user.id !== company.owner_id)) {
    return fail('Company not yet approved', 403);
  }

  await env.DB.prepare('UPDATE companies SET views=views+1 WHERE id=?').bind(company.id).run();
  company.views = (company.views || 0) + 1;

  const products = await env.DB.prepare(
    'SELECT * FROM company_products WHERE company_id=? AND status=? ORDER BY featured DESC, created_at DESC'
  ).bind(company.id, 'active').all();

  return json({
    ok: true,
    company: pickCompany(company),
    products: (products.results || []).map(pickProduct)
  });
}
