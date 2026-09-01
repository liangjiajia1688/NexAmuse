import { json, fail, getMyCompany, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// Member article management — articles belong to the supplier's company.
// All queries are scoped to the logged-in user's owned company (company_id),
// so a member can never touch another company's content.

const CATEGORIES = ['Industry Dynamics', 'Company News', 'Executive Interviews', 'New Product Releases', 'Regulations & Compliance', 'Buyer Guide'];

function canManage(user) {
  return user.role === 'admin' || user.is_super || ['Premium', 'VIP'].includes(user.level);
}

function ownClause(env, user, id) {
  // returns the article row only if it belongs to the user's company
  return env.DB.prepare('SELECT * FROM articles WHERE id=? AND company_id=?')
    .bind(id, user._companyId).first();
}

export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (user.status === 'banned') return fail('Account banned', 403);
  if (!canManage(user)) return fail('Article management requires Premium or VIP membership', 403);

  const company = await getMyCompany(env, user.id);
  if (!company) return fail('Create your company profile first', 400);
  user._companyId = company.id;

  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id,title,excerpt,category,cover,status,published_at,views FROM articles WHERE company_id=? ORDER BY published_at DESC'
    ).bind(company.id).all();
    return json({ ok: true, articles: rows.results || [] });
  }

  if (request.method === 'POST') {
    let b;
    try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const title = String(b.title || '').trim();
    if (!title || title.length < 3) return fail('Title is required');
    const content = String(b.content || '').trim();
    if (content.length < 10) return fail('Content is too short');
    const category = CATEGORIES.includes(b.category) ? b.category : 'Company News';
    const excerpt = String(b.excerpt || '').trim().slice(0, 300) || content.replace(/<[^>]+>/g, ' ').slice(0, 160);
    const cover = String(b.cover || '').trim().slice(0, 500);
    const ts = now();
    const res = await env.DB.prepare(
      'INSERT INTO articles (title,excerpt,content,category,cover,author,user_id,company_id,status,published_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).bind(title, excerpt, content, category, cover, user.username, user.id, company.id, b.status === 'draft' ? 'draft' : 'published', ts).run();
    return json({ ok: true, id: res.meta.last_row_id, message: 'Article saved' }, 201);
  }

  if (request.method === 'PUT' || request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (!id) return fail('id is required');
    const existing = await ownClause(env, user, id);
    if (!existing) return fail('Article not found or forbidden', 404);

    if (request.method === 'PUT') {
      let b;
      try { b = await request.json(); } catch (e) { return fail('Invalid JSON'); }
      const title = String(b.title || existing.title || '').trim();
      const content = String(b.content || existing.content || '').trim();
      const category = CATEGORIES.includes(b.category) ? b.category : existing.category;
      const excerpt = String(b.excerpt || '').trim().slice(0, 300) || content.replace(/<[^>]+>/g, ' ').slice(0, 160);
      const cover = String(b.cover || existing.cover || '').trim().slice(0, 500);
      await env.DB.prepare(
        'UPDATE articles SET title=?, excerpt=?, content=?, category=?, cover=?, status=? WHERE id=?'
      ).bind(title, excerpt, content, category, cover, b.status === 'draft' ? 'draft' : (b.status || existing.status), id).run();
      return json({ ok: true, message: 'Article updated' });
    }

    await env.DB.prepare('DELETE FROM articles WHERE id=?').bind(id).run();
    return json({ ok: true, message: 'Article deleted' });
  }

  return fail('Method not allowed', 405);
}
