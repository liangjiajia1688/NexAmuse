import { json, fail, now } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);

  const path = url.pathname.replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  const id = segments[segments.length - 1];

  if (request.method === 'GET') {
    const productId = parseInt(url.searchParams.get('product_id') || '0', 10);
    if (!productId) return fail('product_id required', 400);
    const rows = await env.DB.prepare(
      `SELECT id, product_id, image_type, original_url, compressed_url, original_size, compressed_size, mime_type, sort_order, created_at
       FROM product_images WHERE product_id=? ORDER BY image_type, sort_order, id`
    ).bind(productId).all();
    return json({ ok: true, images: rows.results || [] });
  }

  if (request.method === 'DELETE') {
    const imageId = parseInt(id, 10);
    if (!imageId) return fail('Invalid id', 400);
    const img = await env.DB.prepare('SELECT * FROM product_images WHERE id=?').bind(imageId).first();
    if (!img) return fail('Not found', 404);
    const product = await env.DB.prepare('SELECT company_id FROM company_products WHERE id=?').bind(img.product_id).first();
    if (!product) return fail('Not found', 404);
    const company = await env.DB.prepare('SELECT owner_id FROM companies WHERE id=?').bind(product.company_id).first();
    const isAdmin = user.role === 'admin' || user.is_super;
    if (!isAdmin && company && company.owner_id !== user.id) return fail('Forbidden', 403);
    await env.DB.prepare('DELETE FROM product_images WHERE id=?').bind(imageId).run();
    return json({ ok: true, message: 'Image removed' });
  }

  if (request.method === 'PUT') {
    const imageId = parseInt(id, 10);
    if (!imageId) return fail('Invalid id', 400);
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const img = await env.DB.prepare('SELECT * FROM product_images WHERE id=?').bind(imageId).first();
    if (!img) return fail('Not found', 404);
    await env.DB.prepare(
      `UPDATE product_images SET compressed_url=?, compressed_size=?, mime_type=?, updated_at=? WHERE id=?`
    ).bind(
      body.compressed_url || img.compressed_url,
      body.compressed_size || img.compressed_size,
      body.mime_type || img.mime_type || 'image/webp',
      now(),
      imageId
    ).run();
    return json({ ok: true, message: 'Image updated' });
  }

  return fail('Method not allowed', 405);
}
