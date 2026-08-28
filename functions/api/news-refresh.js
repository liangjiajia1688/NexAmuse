import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

// Global amusement / attractions industry RSS feeds.
// Risk-safe aggregation: store only title + short summary + source + original link.
// All rights belong to the original publishers.
const FEEDS = [
  { url: 'https://blooloop.com/feed/',                      source: 'Blooloop',              category: 'industry',  country: 'Global' },
  { url: 'https://attractionsmagazine.com/feed/',           source: 'Attractions Magazine',  category: 'industry',  country: 'USA' },
  { url: 'https://www.parkworld-online.com/feed/',          source: 'Park World',            category: 'industry',  country: 'UK' },
  { url: 'https://amusementtoday.com/feed/',                source: 'Amusement Today',       category: 'industry',  country: 'USA' },
  { url: 'https://www.laughingplace.com/feed/',             source: 'Laughing Place',        category: 'industry',  country: 'USA' },
  { url: 'https://www.coaster101.com/feed/',                source: 'Coaster101',            category: 'industry',  country: 'USA' },
  { url: 'https://www.iaapa.org/rss.xml',                   source: 'IAAPA',                 category: 'industry',  country: 'USA' },
  { url: 'https://orlandoattractions.com/feed/',            source: 'Orlando Attractions',   category: 'industry',  country: 'USA' }
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
        source: feed.source,
        category: guessCategory(title, desc, feed.category),
        country: feed.country,
        published_at: pub ? Date.parse(pub) || Date.now() : Date.now()
      });
    }
  }
  return items;
}

function authed(context) {
  const { request, env } = context;
  const key = new URL(request.url).searchParams.get('key');
  const cronHeader = request.headers.get('x-cron-secret') || '';
  const cronKey = env.CRON_KEY || env.TOKEN_SECRET;
  const keyOk = !!cronKey && (key === cronKey || cronHeader === cronKey);
  if (keyOk) return true;
  try {
    return authUser(request, env).then((u) => !!(u && u.role === 'admin'));
  } catch (e) {
    return false;
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  // GET — stats for the admin panel (no crawl).
  if (request.method === 'GET') {
    if (!(await authed(context))) return fail('Unauthorized', 401);
    const total = await env.DB.prepare('SELECT COUNT(*) AS c FROM news').first();
    const bySource = await env.DB.prepare('SELECT source, COUNT(*) AS c FROM news GROUP BY source ORDER BY c DESC').all();
    const newest = await env.DB.prepare('SELECT MAX(published_at) AS t FROM news').first();
    return json({
      ok: true,
      total: total ? total.c : 0,
      bySource: (bySource.results || []).map((r) => ({ source: r.source, count: r.c })),
      lastPublishedAt: newest && newest.t ? newest.t : null
    });
  }

  if (request.method !== 'POST') return fail('Method not allowed', 405);
  if (!(await authed(context))) return fail('Unauthorized', 401);

  let added = 0;
  const errors = [];
  const bySource = {};

  for (const f of FEEDS) {
    try {
      // Retry once on transient 503/429 (Google News sometimes throttles datacenter IPs).
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
      const items = parseFeed(xml, f);
      let sourceAdded = 0;
      for (const it of items.slice(0, 15)) {
        const res = await env.DB.prepare(
          'INSERT OR IGNORE INTO news (title, summary, url, source, category, published_at) VALUES (?,?,?,?,?,?)'
        ).bind(it.title, it.summary, it.url, it.source, it.category, it.published_at).run();
        if (res.meta && res.meta.changes) { added++; sourceAdded++; }
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

  const total = await env.DB.prepare('SELECT COUNT(*) AS c FROM news').first();
  return json({ ok: true, added, total: total ? total.c : 0, bySource, errors });
}
