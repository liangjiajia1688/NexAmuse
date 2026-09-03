import { json, fail, now } from '../../../_lib/db.js';
import { authUser } from '../../../_lib/auth.js';

// /api/admin/leads/:id
//   POST  -> approve a lead (status='approved')
//   GET   -> fetch single lead detail (for editing)
//   PUT   -> update lead fields
//   DELETE-> delete a lead (status='lead' company)
export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user || (user.role !== 'admin' && !user.is_super)) return fail('Unauthorized', 401);

  const id = parseInt(context.params.id, 10);
  if (!id) return fail('Invalid id', 400);

  const company = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(id).first();
  if (!company) return fail('Lead not found', 404);

  if (request.method === 'POST') {
    await env.DB.prepare("UPDATE companies SET status='approved', updated_at=? WHERE id=?").bind(now(), id).run();
    const row = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(id).first();
    return json({ ok: true, company: row });
  }

  if (request.method === 'GET') {
    return json({ ok: true, company });
  }

  if (request.method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    // editable text fields (slug kept unchanged to avoid UNIQUE collision)
    const fields = ['name','country','city','contact_name','email','phone','website','primary_category','description','source'];
    const sets = [];
    const binds = [];
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=?`); binds.push(String(body[f] ?? '')); }
    }
    if (!sets.length) return fail('No editable fields provided', 400);
    sets.push('updated_at=?');
    binds.push(now());
    binds.push(id);
    await env.DB.prepare(`UPDATE companies SET ${sets.join(',')} WHERE id=?`).bind(...binds).run();
    const row = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(id).first();
    return json({ ok: true, company: row });
  }

  if (request.method === 'DELETE') {
    // only allow deleting leads (not approved/real companies)
    if (company.status !== 'lead') return fail('Only leads (status=lead) can be deleted here', 400);
    await env.DB.prepare('DELETE FROM company_products WHERE company_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM companies WHERE id=?').bind(id).run();
    return json({ ok: true, deleted: id });
  }

  return fail('Method not allowed', 405);
}
