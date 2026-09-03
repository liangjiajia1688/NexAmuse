import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

// Global amusement / attractions industry RSS feeds.
const FEEDS = [
  { id: 'blooloop',       url: 'https://blooloop.com/feed/',                      source: 'Blooloop',              category: 'industry',  country: 'Global' },
  { id: 'attractions',    url: 'https://attractionsmagazine.com/feed/',           source: 'Attractions Magazine',  category: 'industry',  country: 'USA' },
  { id: 'parkworld',      url: 'https://www.parkworld-online.com/feed/',          source: 'Park World',            category: 'industry',  country: 'UK' },
  { id: 'amusementtoday', url: 'https://amusementtoday.com/feed/',                source: 'Amusement Today',       category: 'industry',  country: 'USA' },
  { id: 'laughingplace',  url: 'https://www.laughingplace.com/feed/',             source: 'Laughing Place',        category: 'industry',  country: 'USA' },
  { id: 'coaster101',     url: 'https://www.coaster101.com/feed/',                source: 'Coaster101',            category: 'industry',  country: 'USA' },
  { id: 'iaapa',          url: 'https://www.iaapa.org/rss.xml',                   source: 'IAAPA',                 category: 'industry',  country: 'USA' },
  { id: 'orlando',        url: 'https://orlandoattractions.com/feed/',            source: 'Orlando Attractions',   category: 'industry',  country: 'USA' }
];

// Lightweight keyword category guesser so the frontend filter tabs work.
function guessCategory(title, summary, fallback) {
  const t = ((title || '') + ' ' + (summary || '')).toLowerCase();
  const has = (words) => words.some((w) => t.includes(w));
  if (has(['iaapa', ' expo', 'expo ', 'trade show', 'exhibition', 'conference', 'summit', 'show floor'])) return 'exhibitions';
  if (has(['acquire', 'acquisition', 'partnership', 'investment', 'expands', 'merger', 'appoints', 'revenue', 'quarterly', 'announces', 'launch', 'open'])) return 'companies';
  if (has(['safety', 'standard', 'astm', 'en 13814', 'compliance', 'regulation', 'recall', 'inspector', 'ban '])) return 'regulation';
  if (has(['vr', ' ar ', 'xr', ' ai ', 'robotics', 'digital', 'cashless', 'software', 'immersive', ' app ', 'technology'])) return 'technology';
  if (has(['interview', ' q&a', 'ceo', 'podcast', 'sits down'])) return 'interviews';
  return fallback || 'industry';
}

// Decode entities + strip HTML tags, CDATA.
function decode(s) {
  if (!s) return '';
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract a compliant thumbnail from publisher-distributed RSS fields only
// (enclosure / media:content / media:thumbnail / first <img> in description).
// We NEVER scrape the publisher's homepage — these are feed-provided images.
function extractImage(block) {
  let m;
  m = block.match(/<enclosure[^>]*url="([^"]+)"/i);
  if (m && /\.(jpg|jpeg|png|webp|gif|avif)/i.test(m[1])) return m[1];
  m = block.match(/<media:content[^>]+url="([^"]+)"/i) || block.match(/<media:content[^>]+url='([^']+)'/i);
  if (m) return m[1];
  m = block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (m) return m[1];
  m = block.match(/<img[^>]+src="([^"]+)"/i);
  if (m) return m[1];
  return '';
}

function parseFeed(xml, feed) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  for (const block of blocks) {
    const title = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = decode((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    const desc = decode((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1]);
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
    if (title && link && /^https?:\/\//.test(link)) {
      items.push({
        title,
        url: link,
        summary: desc.slice(0, 250),
        image: extractImage(block),
        source: feed.source,
        category: guessCategory(title, desc, feed.category),
        country: feed.country,
        published_at: pub ? Date.parse(pub) || Date.now() : Date.now()
      });
    }
  }
  return items;
}

async function authed(context) {
  const { request, env } = context;
  const key = new URL(request.url).searchParams.get('key');
  const cronHeader = request.headers.get('x-cron-secret') || '';
  const cronKey = env.CRON_KEY || env.TOKEN_SECRET;
  const keyOk = !!cronKey && (key === cronKey || cronHeader === cronKey);
  if (keyOk) return true;
  try {
    const u = await authUser(request, env);
    return !!(u && u.role === 'admin');
  } catch (e) {
    return false;
  }
}

async function getStats(env) {
  const total = await env.DB.prepare('SELECT COUNT(*) AS c FROM news').first();
  const published = await env.DB.prepare("SELECT COUNT(*) AS c FROM news WHERE status = 'published'").first();
  const bySource = await env.DB.prepare('SELECT source, COUNT(*) AS c FROM news GROUP BY source ORDER BY c DESC').all();
  const newest = await env.DB.prepare('SELECT MAX(published_at) AS t FROM news WHERE status = \'published\'').first();
  return {
    total: total ? total.c : 0,
    published: published ? published.c : 0,
    pending: (total ? total.c : 0) - (published ? published.c : 0),
    bySource: (bySource.results || []).map((r) => ({ source: r.source, count: r.c })),
    lastPublishedAt: newest && newest.t ? newest.t : null
  };
}

async function doPublish(env, scope) {
  let result;
  if (scope === 'last-scan') {
    const since = Date.now() - 5 * 60 * 1000;
    result = await env.DB.prepare(
      "UPDATE news SET status = 'published' WHERE status = 'pending' AND created_at >= ?"
    ).bind(since).run();
  } else {
    result = await env.DB.prepare(
      "UPDATE news SET status = 'published' WHERE status = 'pending'"
    ).run();
  }
  const published = result && result.meta ? result.meta.changes : 0;
  const stats = await getStats(env);
  return json({ ok: true, published, ...stats });
}

async function doCrawl(env, request, body) {
  const cronHeader = request.headers.get('x-cron-secret') || '';
  const cronKey = env.CRON_KEY || env.TOKEN_SECRET;
  const fromCron = !!cronKey && cronHeader === cronKey;

  const days = Math.max(1, Math.min(90, parseInt(body.days, 10) || 7));
  const selectedIds = Array.isArray(body.sources) && body.sources.length > 0
    ? new Set(body.sources)
    : new Set(FEEDS.map(f => f.id));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  let added = 0;
  const errors = [];
  const bySource = {};

  for (const f of FEEDS) {
    if (!selectedIds.has(f.id)) continue;
    try {
      let r = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        r = await fetch(f.url, {
          headers: {
            'User-Agent': 'NexAmuseBot/1.0 (+https://nexamuse.cc.cd; RSS aggregator)',
            Accept: 'application/rss+xml, application/xml, text/xml, */*'
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000)
        });
        if (r.ok || (r.status !== 503 && r.status !== 429)) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (!r.ok) { errors.push(f.source + ':HTTP' + r.status); continue; }
      const xml = await r.text();
      const items = parseFeed(xml, f).filter(it => it.published_at >= cutoff);
      let sourceAdded = 0;
      for (const it of items.slice(0, 15)) {
        const res = await env.DB.prepare(
          'INSERT OR IGNORE INTO news (title, summary, url, image, source, category, published_at, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
        ).bind(it.title, it.summary, it.url, it.image || null, it.source, it.category, it.published_at, 'pending', Date.now()).run();
        if (res.meta && res.meta.changes) { added++; sourceAdded++; }
        // Backfill image on any existing row with the same title but no image yet.
        if (it.image) {
          try {
            await env.DB.prepare("UPDATE news SET image = ? WHERE title = ? AND (image IS NULL OR image = '')").bind(it.image, it.title).run();
          } catch (e) {}
        }
      }
      bySource[f.source] = sourceAdded;
    } catch (e) {
      errors.push(f.source + ':' + (e && e.message ? e.message : e));
    }
  }

  // Keep the table bounded: prune beyond the newest 800 rows.
  try {
    await env.DB.prepare(
      'DELETE FROM news WHERE id NOT IN (SELECT id FROM news ORDER BY published_at DESC LIMIT 800)'
    ).run();
  } catch (e) {}

  // Auto-publish when triggered by the daily cron worker so the public news page stays fresh.
  if (fromCron && added > 0) {
    try {
      await env.DB.prepare(
        "UPDATE news SET status = 'published' WHERE status = 'pending' AND created_at >= ?"
      ).bind(Date.now() - 5 * 60 * 1000).run();
    } catch (e) {}
  }

  const stats = await getStats(env);
  return json({ ok: true, added, errors, cronAutoPublish: fromCron && added > 0, ...stats });
}

export async function onRequest(context) {
  const { request, env } = context;

  // ── GET /api/news-refresh ── stats for admin panel
  if (request.method === 'GET') {
    if (!(await authed(context))) return fail('Unauthorized', 401);
    const stats = await getStats(env);
    return json({ ok: true, ...stats });
  }

  if (request.method !== 'POST') return fail('Method not allowed', 405);
  if (!(await authed(context))) return fail('Unauthorized', 401);

  let body = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch (e) {
    return fail('Invalid JSON body', 400);
  }

  // ── POST /api/news-refresh {action:'publish'} ── make crawled stories public
  if (body.action === 'publish') {
    return doPublish(env, body.scope || 'all');
  }

  // ── POST /api/news-refresh {sources, days} ── crawl selected feeds within a time window
  return doCrawl(env, request, body);
}
