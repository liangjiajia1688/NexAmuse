import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// The 9 canonical product categories (must stay in sync with products-add.html)
export const CATEGORIES = [
  'Arcade Machines',
  'VR / XR Attractions',
  'Kids & Family Rides',
  'Redemption Games',
  'Simulation Rides',
  'Outdoor Attractions',
  'Water Park Equipment',
  'Payment Technology',
  'Accessories & Parts'
];

// GET    /api/admin/products            → list ALL products (admin + member uploaded, any status)
// DELETE /api/admin/products?id=X        → delete a product and its images
export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  const isAdmin = user.role === 'admin' || user.is_super;
  if (!isAdmin) return fail('Admin required', 403);

  const url = new URL(request.url);

  if (request.method === 'GET') {
    // per-category counts for the Categories page + filter dropdown
    const countRows = await env.DB.prepare(
      'SELECT category, COUNT(*) c FROM company_products GROUP BY category'
    ).all();
    const counts = {};
    for (const r of countRows.results || []) counts[r.category || 'Uncategorized'] = r.c;

    const q = (url.searchParams.get('q') || '').trim();
    const cat = url.searchParams.get('cat') || '';
    const status = url.searchParams.get('status') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '20', 10));
    const offset = (page - 1) * limit;

    let where = '1=1';
    const binds = [];
    if (cat) { where += ' AND p.category=?'; binds.push(cat); }
    if (status) { where += ' AND p.status=?'; binds.push(status); }
    if (q) { where += ' AND (p.name LIKE ? OR c.name LIKE ?)'; binds.push('%' + q + '%', '%' + q + '%'); }

    const totalRow = await env.DB.prepare(
      `SELECT COUNT(*) c FROM company_products p LEFT JOIN companies c ON c.id=p.company_id WHERE ${where}`
    ).bind(...binds).first();

    const rows = await env.DB.prepare(
      `SELECT p.id, p.name, p.category, p.price, p.price_type, p.min_price, p.max_price,
              p.status, p.featured, p.visibility, p.company_id, p.created_at,
              c.name AS company_name, c.country AS company_country
       FROM company_products p LEFT JOIN companies c ON c.id=p.company_id
       WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();

    const products = [];
    for (const row of rows.results || []) {
      const img = await env.DB.prepare(
        "SELECT compressed_url, original_url FROM product_images WHERE product_id=? AND (image_type='product' OR image_type IS NULL OR image_type='') ORDER BY sort_order, id LIMIT 1"
      ).bind(row.id).first();
      products.push({
        id: row.id,
        name: row.name,
        category: row.category,
        price: row.price,
        price_type: row.price_type,
        min_price: row.min_price,
        max_price: row.max_price,
        status: row.status,
        featured: row.featured,
        visibility: row.visibility,
        company_name: row.company_name,
        company_country: row.company_country,
        created_at: row.created_at,
        image: img ? (img.compressed_url || img.original_url) : null
      });
    }

    return json({ ok: true, total: totalRow.c || 0, page, limit, products, counts, categories: CATEGORIES });
  }

  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return fail('Missing id');
    const row = await env.DB.prepare('SELECT id FROM company_products WHERE id=?').bind(id).first();
    if (!row) return fail('Product not found', 404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM product_images WHERE product_id=?').bind(id),
      env.DB.prepare('DELETE FROM company_products WHERE id=?').bind(id)
    ]);
    return json({ ok: true });
  }

  return fail('Method not allowed', 405);
}
