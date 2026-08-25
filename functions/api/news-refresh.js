// 新闻聚合刷新：抓取 RSS 源，写入 D1（仅存标题+摘要+出处+原文链接）
// 触发方式：GET/POST /api/news-refresh?key=TOKEN_SECRET
// 也可由 GitHub Action 每日定时 curl 触发

import { json, now } from '../../src/lib/db.js';

// 全球游戏 / 游艺 / 动漫 媒体 RSS 源
const FEEDS = [
  { name: 'IGN',            url: 'https://feeds.ign.com/ign/all',                       cat: '游戏' },
  { name: 'Polygon',        url: 'https://www.polygon.com/rss/index.xml',              cat: '游戏' },
  { name: 'GameSpot',       url: 'https://www.gamespot.com/feeds/news/',              cat: '游戏' },
  { name: 'Anime News Network', url: 'https://www.animenewsnetwork.com/all/rss.xml',   cat: '动漫' },
  { name: 'Kotaku',         url: 'https://kotaku.com/rss',                             cat: '游戏' },
];

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1] : '';
}
function clean(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFeed(xml) {
  const out = [];
  // RSS <item>
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const b = m[1];
    const title = clean(tag(b, 'title'));
    let link = clean(tag(b, 'link'));
    const desc = clean(tag(b, 'description') || tag(b, 'summary'));
    const pub = clean(tag(b, 'pubDate') || tag(b, 'published'));
    if (title && link) out.push({ title, summary: desc.slice(0, 320), source_url: link, published_at: pub ? Math.floor(Date.parse(pub) / 1000) : 0 });
  }
  // Atom <entry>
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml))) {
    const b = m[1];
    const title = clean(tag(b, 'title'));
    const linkM = b.match(/<link[^>]*href="([^"]+)"/i) || b.match(/<link>([^<]+)<\/link>/i);
    const link = linkM ? linkM[1] : clean(tag(b, 'link'));
    const desc = clean(tag(b, 'summary') || tag(b, 'content'));
    const pub = clean(tag(b, 'updated') || tag(b, 'published'));
    if (title && link) out.push({ title, summary: desc.slice(0, 320), source_url: link, published_at: pub ? Math.floor(Date.parse(pub) / 1000) : 0 });
  }
  return out;
}

async function refresh(env) {
  let added = 0;
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 NexAmuseNewsBot/1.0' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseFeed(xml);
      for (const it of items) {
        const exist = await env.DB.prepare('SELECT id FROM news WHERE source_url = ?').bind(it.source_url).first();
        if (exist) continue;
        await env.DB.prepare(
          'INSERT INTO news (title,summary,source,source_url,category,published_at) VALUES (?,?,?,?,?,?)'
        ).bind(it.title, it.summary, feed.name, it.source_url, feed.cat, it.published_at || now()).run();
        added++;
      }
    } catch (e) {
      // 单个源失败不影响其他源
    }
  }
  return added;
}

export async function onRequestPost({ env, request }) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== env.TOKEN_SECRET) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  const added = await refresh(env);
  return json({ ok: true, added });
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== env.TOKEN_SECRET) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  const added = await refresh(env);
  return json({ ok: true, added });
}
