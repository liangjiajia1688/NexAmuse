import { json } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

const CAT_MAP = {
  arcade: 'Arcade Machines',
  vr: 'VR / XR Attractions',
  kids: 'Kids & Family Rides',
  redemption: 'Redemption Games',
  simulation: 'Simulation Rides',
  outdoor: 'Outdoor Attractions',
  waterpark: 'Water Park Equipment',
  accessories: 'Accessories & Parts',
  payment: 'Payment Technology'
};

async function loadImages(env, productId) {
  return (await env.DB.prepare(
    'SELECT id, product_id, image_type, original_url, compressed_url, original_size, compressed_size, mime_type, sort_order FROM product_images WHERE product_id=? ORDER BY image_type, sort_order, id'
  ).bind(productId).all()).results || [];
}

async function loadProduct(env, row) {
  const images = await loadImages(env, row.id);
  const first = images.find(i => i.image_type === 'product' || !i.image_type);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    short_description: row.short_description,
    description: row.description,
    price: row.price,
    moq: row.moq,
    image: first ? (first.compressed_url || first.original_url) : (row.image || null),
    images: images.map(i => i.compressed_url || i.original_url).filter(Boolean),
    featured: row.featured,
    company_id: row.company_id,
    created_at: row.created_at
  };
}

// GET /api/products?cat=&q=&page=&limit=&sort=
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = await authUser(request, env);
  const isAdmin = user && (user.role === 'admin' || user.is_super);

  const cat = url.searchParams.get('cat') || '';
  const q = (url.searchParams.get('q') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(60, parseInt(url.searchParams.get('limit') || '12', 10));
  const sort = url.searchParams.get('sort') || 'featured';
  const offset = (page - 1) * limit;

  // visibility gate: non-logged-in users only see 'all'
  const visCond = isAdmin ? '' : " AND (visibility IS NULL OR visibility='' OR visibility='all')";

  let where = "p.status='active'";
  const binds = [];
  if (cat && CAT_MAP[cat]) { where += ' AND p.category=?'; binds.push(CAT_MAP[cat]); }
  else if (cat) { where += ' AND p.category LIKE ?'; binds.push('%' + cat + '%'); }
  if (q) { where += ' AND (p.name LIKE ? OR p.short_description LIKE ? OR p.description LIKE ?)'; binds.push('%' + q + '%', '%' + q + '%', '%' + q + '%'); }
  where += visCond;

  let orderBy = 'p.featured DESC, p.created_at DESC';
  if (sort === 'newest') orderBy = 'p.created_at DESC';
  else if (sort === 'price_asc') orderBy = 'p.min_price+0 ASC';
  else if (sort === 'price_desc') orderBy = 'p.max_price+0 DESC';

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) c FROM company_products p WHERE ${where}`
  ).bind(...binds).first();

  const rows = await env.DB.prepare(
    `SELECT p.*, c.name AS company_name, c.slug AS company_slug, c.country AS company_country
     FROM company_products p LEFT JOIN companies c ON c.id=p.company_id
     WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();

  const products = [];
  for (const row of rows.results || []) {
    const p = await loadProduct(env, row);
    p.company_name = row.company_name;
    p.company_slug = row.company_slug;
    p.company_country = row.company_country;
    products.push(p);
  }

  return json({
    ok: true,
    total: totalRow.c || 0,
    page,
    limit,
    products
  });
}
