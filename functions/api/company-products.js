import { json, fail, now } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';
import { canManageCompanyProducts } from '../_lib/permissions.js';

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function pickProduct(row, images) {
  if (!row) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    description: row.description,
    price: row.price,
    moq: row.moq,
    image: row.image,
    images: images || [],
    status: row.status,
    featured: row.featured,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function loadImages(env, productId) {
  return (await env.DB.prepare(
    'SELECT id, product_id, image_type, original_url, compressed_url, original_size, compressed_size, mime_type, sort_order, created_at FROM product_images WHERE product_id=? ORDER BY image_type, sort_order, id'
  ).bind(productId).all()).results || [];
}

async function syncProductImages(env, productId, images) {
  if (!Array.isArray(images) || !images.length) return;
  const ts = now();
  // delete existing images not in the new list
  const keepIds = images.map(i => i.id).filter(Boolean);
  if (keepIds.length) {
    const placeholders = keepIds.map(() => '?').join(',');
    await env.DB.prepare(`DELETE FROM product_images WHERE product_id=? AND id NOT IN (${placeholders})`).bind(productId, ...keepIds).run();
  } else {
    await env.DB.prepare('DELETE FROM product_images WHERE product_id=?').bind(productId).run();
  }
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.id) {
      await env.DB.prepare(
        `UPDATE product_images SET original_url=?, compressed_url=?, original_size=?, compressed_size=?, mime_type=?, image_type=?, sort_order=?, updated_at=? WHERE id=? AND product_id=?`
      ).bind(
        img.original_url || null,
        img.compressed_url || null,
        img.original_size || 0,
        img.compressed_size || 0,
        img.mime_type || 'image/webp',
        img.image_type || 'product',
        i,
        ts,
        img.id,
        productId
      ).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO product_images (product_id, original_url, compressed_url, original_size, compressed_size, mime_type, image_type, sort_order, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        productId,
        img.original_url || null,
        img.compressed_url || null,
        img.original_size || 0,
        img.compressed_size || 0,
        img.mime_type || 'image/webp',
        img.image_type || 'product',
        i,
        ts,
        ts
      ).run();
    }
  }
  // keep first product image in legacy column as thumbnail
  const firstProduct = images.find(i => i.image_type === 'product' || !i.image_type);
  if (firstProduct) {
    await env.DB.prepare('UPDATE company_products SET image=? WHERE id=?').bind(firstProduct.compressed_url || firstProduct.original_url || null, productId).run();
  }
}

async function getMyCompany(env, userId) {
  return env.DB.prepare('SELECT * FROM companies WHERE owner_id=?').bind(userId).first();
}

async function refreshProductCount(env, companyId) {
  const cnt = await env.DB.prepare(
    "SELECT COUNT(*) c FROM company_products WHERE company_id=? AND status='active'"
  ).bind(companyId).first();
  await env.DB.prepare('UPDATE companies SET products_count=? WHERE id=?')
    .bind(cnt.c || 0, companyId).run();
}

// GET  /api/company-products          → my company's products
// POST /api/company-products          → create product for my company
// PUT  /api/company-products?id=X     → update my product
// DELETE /api/company-products?id=X   → delete my product
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (user.status === 'banned') return fail('Account banned', 403);
  const isAdmin = user.role === 'admin' || user.is_super;

  if (request.method === 'GET') {
    const company = await getMyCompany(env, user.id);
    if (!company) return json({ ok: true, company: null, products: [] });
    const rows = await env.DB.prepare(
      'SELECT * FROM company_products WHERE company_id=? ORDER BY featured DESC, created_at DESC'
    ).bind(company.id).all();
    const products = [];
    for (const row of rows.results || []) {
      const images = await loadImages(env, row.id);
      products.push(pickProduct(row, images));
    }
    return json({ ok: true, company: { id: company.id, name: company.name, slug: company.slug, status: company.status }, products });
  }

  if (request.method === 'POST') {
    if (!canManageCompanyProducts(user) && !isAdmin) {
      return fail('Product management requires Premium or VIP membership', 403);
    }

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const company = isAdmin && body.company_id
      ? await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(body.company_id).first()
      : await getMyCompany(env, user.id);

    if (!company) return fail('Create a company profile first', 400);
    if (!isAdmin && company.owner_id !== user.id) return fail('Forbidden', 403);

    const name = (body.name || '').trim();
    if (!name || name.length < 2) return fail('Product name too short');
    if (name.length > 120) return fail('Product name too long');
    const category = (body.category || '').trim() || company.primary_category;
    const description = (body.description || '').trim();
    if (description.length > 2000) return fail('Description too long (max 2000)');
    const price = (body.price || '').trim() || null;
    const moq = (body.moq || '').trim() || null;
    const image = (body.image || '').trim() || null;
    const featured = body.featured ? 1 : 0;
    const ts = now();
    const slug = slugify(name) + '-' + Date.now();

    const res = await env.DB.prepare(
      `INSERT INTO company_products (company_id,owner_id,name,slug,category,description,price,moq,image,status,featured,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(company.id, user.id, name, slug, category, description, price, moq, image, 'active', featured, ts, ts).run();

    const productId = res.meta.last_row_id;
    await syncProductImages(env, productId, body.images || []);
    await refreshProductCount(env, company.id);
    const row = await env.DB.prepare('SELECT * FROM company_products WHERE id=?').bind(productId).first();
    const images = await loadImages(env, productId);
    return json({ ok: true, product: pickProduct(row, images), message: 'Product added' }, 201);
  }

  if (request.method === 'PUT') {
    if (!canManageCompanyProducts(user) && !isAdmin) {
      return fail('Product management requires Premium or VIP membership', 403);
    }
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);

    const existing = await env.DB.prepare('SELECT * FROM company_products WHERE id=?').bind(id).first();
    if (!existing) return fail('Product not found', 404);
    const company = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(existing.company_id).first();
    if (!isAdmin && company.owner_id !== user.id) return fail('Forbidden', 403);

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const name = (body.name || existing.name).trim();
    const category = (body.category || existing.category || '').trim();
    const description = (body.description || '').trim();
    const price = (body.price !== undefined ? (body.price || '').trim() : existing.price) || null;
    const moq = (body.moq !== undefined ? (body.moq || '').trim() : existing.moq) || null;
    const image = (body.image !== undefined ? (body.image || '').trim() : existing.image) || null;
    const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : existing.featured;
    const status = isAdmin && body.status ? body.status : existing.status;
    const ts = now();

    await env.DB.prepare(
      `UPDATE company_products SET name=?, category=?, description=?, price=?, moq=?, image=?, featured=?, status=?, updated_at=?
       WHERE id=?`
    ).bind(name, category, description, price, moq, image, featured, status, ts, id).run();

    await syncProductImages(env, id, body.images || []);
    await refreshProductCount(env, existing.company_id);
    const row = await env.DB.prepare('SELECT * FROM company_products WHERE id=?').bind(id).first();
    const images = await loadImages(env, id);
    return json({ ok: true, product: pickProduct(row, images), message: 'Product updated' });
  }

  if (request.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('Invalid id', 400);

    const existing = await env.DB.prepare('SELECT * FROM company_products WHERE id=?').bind(id).first();
    if (!existing) return fail('Product not found', 404);
    const company = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(existing.company_id).first();
    if (!isAdmin && company.owner_id !== user.id) return fail('Forbidden', 403);

    await env.DB.prepare('DELETE FROM company_products WHERE id=?').bind(id).run();
    await refreshProductCount(env, existing.company_id);
    return json({ ok: true, message: 'Product deleted' });
  }

  return fail('Method not allowed', 405);
}
