import { json, fail, getMyCompany } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';
import { uploadToTutu } from '../../_lib/tutu.js';
import { parseText, fetchLink, commitProducts } from '../../_lib/importer.js';

// Member (supplier) bulk import — same 4 channels as admin, but the company is
// ALWAYS derived from the logged-in user's owned company (never trusted from client),
// and imported products go live immediately ('active') on their own storefront.

function canManage(user) {
  return user.role === 'admin' || user.is_super || ['Premium', 'VIP'].includes(user.level);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (user.status === 'banned') return fail('Account banned', 403);
  if (!canManage(user)) return fail('Product import requires Premium or VIP membership', 403);

  const company = await getMyCompany(env, user.id);
  if (!company) return fail('Create your company profile first', 400);

  let b;
  try { b = await request.json(); } catch (e) { return fail('Invalid JSON', 400); }
  const action = b.action || '';

  if (action === 'parse-text') {
    const r = await parseText(env, String(b.text || '').trim());
    return json(r.ok ? r : { ok: false, error: r.error }, 200);
  }

  if (action === 'fetch-link') {
    const r = await fetchLink(String(b.url || '').trim());
    return json(r, 200);
  }

  if (action === 'commit') {
    const res = await commitProducts(b.products, env, company.id, user.id, 'active', uploadToTutu);
    if (!res.ok) return fail(res.error, res.code || 400);
    return json(res);
  }

  return fail('Unknown action', 400);
}
