import { json, fail } from '../_lib/db.js';

// Global amusement / gaming / anime RSS feeds.
const FEEDS = [
  { url: 'https://feeds.ign.com/ign/all', source: 'IGN', category: 'gaming' },
  { url: 'https://www.polygon.com/rss/index.xml', source: 'Polygon', category: 'gaming' },
  { url: 'https://www.gamespot.com/feeds/news/', source: 'GameSpot', category: 'gaming' },
  { url: 'https://www.animenewsnetwork.com/all/rss.xml', source: 'Anime News Network', category: 'anime' },
  { url: 'https://kotaku.com/rss', source: 'Kotaku', category: 'gaming' }
];

function decode(s) {
  if (!s) return '';
  return s.replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function parseFeed(xml, source, category) {
  const items = [];
  // RSS 2.0
  const rssBlocks = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  for (const block of rssBlocks) {
    const title = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = decode((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    const desc = decode((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1]);
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
    if (title && link) {
      items.push({ title, url: link, summary: desc.slice(0, 280), source, category, published_at: pub ? Date.parse(pub) : Date.now() });
    }
  }
  // Atom fallback
  if (!items.length) {
    const entries = xml.match(/<entry[\s\S]*?<\/entry>/g) || [];
    for (const block of entries) {
      const title = decode((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]);
      const linkM = block.match(/<link[^>]*href="([^"]+)"[^>]*\/>/) || block.match(/<link>([\s\S]*?)<\/link>/);
      const link = linkM ? linkM[1] : '';
      const summary = decode((block.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || (block.match(/<content>([\s\S]*?)<\/content>/) || [])[1]);
      const updated = (block.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1];
      if (title && link) items.push({ title, url: link, summary: summary.slice(0, 280), source, category, published_at: updated ? Date.parse(updated) : Date.now() });
    }
  }
  return items;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return fail('Method not allowed', 405);
  const key = new URL(request.url).searchParams.get('key');
  if (!env.TOKEN_SECRET || key !== env.TOKEN_SECRET) return fail('Unauthorized', 401);

  let added = 0;
  const errors = [];
  for (const f of FEEDS) {
    try {
      const r = await fetch(f.url, { headers: { 'User-Agent': 'NexAmuseBot/1.0' } });
      if (!r.ok) { errors.push(f.source + ':HTTP' + r.status); continue; }
      const xml = await r.text();
      const items = parseFeed(xml, f.source, f.category);
      for (const it of items.slice(0, 12)) {
        const res = await env.DB.prepare(
          'INSERT OR IGNORE INTO news (title,summary,url,source,category,published_at) VALUES (?,?,?,?,?,?)'
        ).bind(it.title, it.summary, it.url, it.source, it.category, it.published_at || Date.now()).run();
        if (res.meta && res.meta.changes) added++;
      }
    } catch (e) {
      errors.push(f.source + ':' + e.message);
    }
  }
  return json({ ok: true, added, errors });
}
