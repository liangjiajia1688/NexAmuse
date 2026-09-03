import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

function slugify(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

// 从中文/英文地址粗略推断国家与城市
function parseCountryCity(address) {
  const a = address || '';
  let country = 'China';
  if (/usa|united states|america/i.test(a)) country = 'USA';
  else if (/japan/i.test(a)) country = 'Japan';
  else if (/korea/i.test(a)) country = 'South Korea';
  else if (/taiwan/i.test(a)) country = 'Taiwan';
  else if (/[\u4e00-\u9fff]/.test(a)) country = 'China';
  let city = null;
  const m = a.match(/([\u4e00-\u9fff]{2,10}?(?:市|区|县))/);
  if (m) city = m[1];
  return { country, city };
}

export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user || (user.role !== 'admin' && !user.is_super)) return fail('Unauthorized', 401);
  const url = new URL(request.url);

  // GET —— 列出已导入的招商线索(lead)
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      "SELECT id,name,contact_name,phone,email,website,city,country,source,status,created_at FROM companies WHERE status='lead' ORDER BY created_at DESC"
    ).all();
    return json({ ok: true, leads: rows.results || [] });
  }

  // POST —— 批量导入线索（CSV 解析后的行数组）
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return fail('No rows provided', 400);

    let inserted = 0, skipped = 0;
    for (const r of rows) {
      const email = (r.email || '').trim();
      const phone = (r.phone || '').trim();
      if (!email && !phone) { skipped++; continue; }

      // 去重：同 email 或同 phone 已存在则跳过
      const dup = await env.DB.prepare('SELECT id FROM companies WHERE email=? OR phone=?')
        .bind(email, phone).first();
      if (dup) { skipped++; continue; }

      const name = (r.company_name || '').trim() || `GTI Lead ${phone || email}`.slice(0, 120);
      const { country, city } = parseCountryCity(r.address);
      const slug = `${slugify(name) || 'lead'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const source = (r.source || 'GTI China 2026').toString().slice(0, 120);
      const description = (r.products || r.product || '').toString().slice(0, 2000);
      const contact = (r.contact_name || '').trim() || null;
      const web = (r.website || '').trim() || null;

      await env.DB.prepare(
        `INSERT INTO companies (owner_id,name,slug,country,city,contact_name,email,phone,website,primary_category,description,status,source,featured,views,products_count,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        user.id, name, slug, country, city, contact, email || null, phone || null, web, null,
        description, 'lead', source, 0, 0, 0, now(), now()
      ).run();
      inserted++;
    }
    return json({ ok: true, inserted, skipped, total: rows.length });
  }

  return fail('Method not allowed', 405);
}
