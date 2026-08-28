import { json, fail } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// GET /api/admin/dashboard — real-time summary for the admin dashboard.
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user || user.role !== 'admin') return fail('Admin access required', 401);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const todayStart = Math.floor(now / day) * day;
  const weekStart = now - 7 * day;

  try {
    // helper: count rows forgiving tables that may not exist yet
    async function count(table, where = '') {
      const tableExists = await env.DB.prepare(
        "SELECT 1 c FROM sqlite_master WHERE type='table' AND name=?"
      ).bind(table).first();
      if (!tableExists) return 0;
      const sql = `SELECT COUNT(*) c FROM ${table}` + (where ? ' WHERE ' + where : '');
      const res = await env.DB.prepare(sql).first();
      return res ? res.c || 0 : 0;
    }

    // counts
    const members = await count('users');
    const products = await count('products');
    const articles = await count('articles', "status='published'");
    const news = await count('news', "status='published'");
    const companies = await count('companies');
    const exhibitions = await count('exhibitions');
    const commentsPending = await count('comments', "status='pending'");

    // new this period
    const membersWeek = await env.DB.prepare("SELECT COUNT(*) c FROM users WHERE created_at >= ?").bind(weekStart).first();
    const productsMonth = products
      ? await env.DB.prepare("SELECT COUNT(*) c FROM products WHERE created_at >= ?").bind(now - 30 * day).first()
      : { c: 0 };
    const articlesWeek = await env.DB.prepare("SELECT COUNT(*) c FROM articles WHERE status='published' AND published_at >= ?").bind(weekStart).first();

    // recent lists
    const recentMembers = await env.DB.prepare(
      "SELECT id, username, email, role, level, created_at FROM users ORDER BY created_at DESC LIMIT 5"
    ).all();
    const recentArticles = await env.DB.prepare(
      "SELECT id, title, category, author, status, published_at FROM articles ORDER BY published_at DESC LIMIT 5"
    ).all();
    const recentNews = await env.DB.prepare(
      "SELECT id, title, source, category, published_at FROM news WHERE status='published' ORDER BY published_at DESC LIMIT 5"
    ).all();
    const recentCompanies = await env.DB.prepare(
      "SELECT id, name, slug, country, city, created_at FROM companies ORDER BY created_at DESC LIMIT 5"
    ).all();
    const recentExhibitions = await env.DB.prepare(
      "SELECT id, name, city, country, startDate, updated_at FROM exhibitions ORDER BY updated_at DESC LIMIT 5"
    ).all();

    return json({
      ok: true,
      counts: {
        members,
        products,
        articles,
        news,
        companies,
        exhibitions,
        commentsPending,
      },
      growth: {
        membersThisWeek: membersWeek.c || 0,
        productsThisMonth: productsMonth.c || 0,
        articlesThisWeek: articlesWeek.c || 0,
      },
      recent: {
        members: recentMembers.results || [],
        articles: recentArticles.results || [],
        news: recentNews.results || [],
        companies: recentCompanies.results || [],
        exhibitions: recentExhibitions.results || [],
      }
    }, 200);
  } catch (e) {
    return fail('DB error: ' + e.message, 500);
  }
}
