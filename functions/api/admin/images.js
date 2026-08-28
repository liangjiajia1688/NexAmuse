import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Unauthorized', 401);

  const path = url.pathname.replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  const id = segments[segments.length - 1];

  if (request.method === 'GET') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const type = url.searchParams.get('type') || '';
    const q = url.searchParams.get('q') || '';
    const noCompress = url.searchParams.has('no_compress');

    let countSql = `SELECT COUNT(*) c FROM product_images i LEFT JOIN company_products p ON p.id=i.product_id LEFT JOIN companies c2 ON c2.id=p.company_id WHERE 1=1`;
    let sql = `SELECT i.*, p.name AS product_name, p.slug AS product_slug, c2.name AS company_name
               FROM product_images i
               LEFT JOIN company_products p ON p.id=i.product_id
               LEFT JOIN companies c2 ON c2.id=p.company_id
               WHERE 1=1`;
    const params = [];
    if (type) {
      sql += ' AND i.image_type=?';
      countSql += ' AND i.image_type=?';
      params.push(type);
    }
    if (noCompress) {
      sql += ' AND (i.compressed_url IS NULL OR i.compressed_url=\'\')';
      countSql += ' AND (i.compressed_url IS NULL OR i.compressed_url=\'\')';
    }
    if (q) {
      sql += ' AND (p.name LIKE ? OR c2.name LIKE ?)';
      countSql += ' AND (p.name LIKE ? OR c2.name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';

    const [rows, count] = await Promise.all([
      env.DB.prepare(sql).bind(...params, limit, offset).all(),
      env.DB.prepare(countSql).bind(...params).first()
    ]);

    return json({
      ok: true,
      images: rows.results || [],
      total: count.c || 0,
      limit,
      offset
    });
  }

  if (request.method === 'PUT') {
    const imageId = parseInt(id, 10);
    if (!imageId) return fail('Invalid id', 400);
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    await env.DB.prepare(
      `UPDATE product_images SET compressed_url=?, compressed_size=?, mime_type=?, updated_at=? WHERE id=?`
    ).bind(
      body.compressed_url || null,
      body.compressed_size || 0,
      body.mime_type || 'image/webp',
      now(),
      imageId
    ).run();
    return json({ ok: true, message: 'Image updated' });
  }

  if (request.method === 'DELETE') {
    const imageId = parseInt(id, 10);
    if (!imageId) return fail('Invalid id', 400);
    await env.DB.prepare('DELETE FROM product_images WHERE id=?').bind(imageId).run();
    return json({ ok: true, message: 'Image deleted' });
  }

  return fail('Method not allowed', 405);
}
