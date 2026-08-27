import { fail } from './_lib/db.js';

export async function onRequestGet(context) {
  const { env } = context;
  const base = (env.SITE_URL || 'https://nexamuse.cc.cd').replace(/\/$/, '');
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, title, category, published_at FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 500`
    ).all();
    const items = (results || []).map(a => {
      const lastmod = a.published_at ? new Date(a.published_at).toISOString().slice(0, 10) : '';
      return `  <url>\n    <loc>${base}/pages/article.html?id=${a.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
    }).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n  <url><loc>${base}/pages/articles.html</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n  <url><loc>${base}/pages/news.html</loc><changefreq>daily</changefreq><priority>0.8</priority></url>\n  <url><loc>${base}/pages/products.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n  <url><loc>${base}/pages/exhibitions.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n  <url><loc>${base}/pages/suppliers.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n${items}\n</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'max-age=600' } });
  } catch (e) {
    return fail('sitemap error: ' + e.message, 500);
  }
}
