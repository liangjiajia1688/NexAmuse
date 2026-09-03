// Daily industry-video aggregator (YouTube Data API v3, official API — no scraping).
// Triggered by the Cron Trigger configured in wrangler.toml:
//   [triggers] crons = ["0 1 * * *"]   (UTC 01:00 = Beijing 09:00)
//
// What it does:
//   1. search.list for each industry keyword (100 quota units each)
//   2. videos.list to fetch title/cover/channel for the results (1 unit, batched)
//   3. inserts candidates with status='pending' and source='youtube_api'
//   4. an admin must approve them in /admin/videos.html before they go public
//
// Public Videos page only shows status='active', so pending items stay hidden
// until reviewed. Quota budget: ~10 keywords * ~101 units ≈ 1,010 units/day
// (well under the free 10,000 units/day cap).

const KEYWORDS = [
  'arcade machine',
  'amusement park ride',
  'FEC family entertainment center',
  'claw machine toy',
  'IAAPA expo',
  'redemption game',
  'VR arcade',
  'pinball machine',
  'theme park attractions',
  'coin op game'
];

function ytEmbed(id) {
  return '<iframe width="100%" height="100%" src="https://www.youtube.com/embed/' + id +
    '" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
}

export async function scheduled(event, env, ctx) {
  const KEY = env.YOUTUBE_API_KEY;
  if (!KEY) {
    return new Response('YOUTUBE_API_KEY not set', { status: 500 });
  }

  let inserted = 0;
  const errors = [];

  for (const kw of KEYWORDS) {
    try {
      // 1) search.list — find recent, relevant public videos
      const searchUrl = 'https://www.googleapis.com/youtube/v3/search?part=snippet' +
        '&type=video&maxResults=5&order=date&relevanceLanguage=en' +
        '&q=' + encodeURIComponent(kw) + '&key=' + KEY;
      const sr = await fetch(searchUrl).then(r => r.json());
      if (sr.error) { errors.push(kw + ': ' + (sr.error.message || 'search error')); continue; }
      const ids = (sr.items || [])
        .map(i => (i.id && i.id.videoId) ? i.id.videoId : null)
        .filter(Boolean);
      if (!ids.length) continue;

      // 2) videos.list — fetch metadata (1 unit per call, batched up to 50)
      const vidUrl = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics' +
        '&id=' + ids.join(',') + '&key=' + KEY;
      const vr = await fetch(vidUrl).then(r => r.json());
      if (vr.error) { errors.push(kw + ': ' + (vr.error.message || 'videos error')); continue; }

      for (const it of (vr.items || [])) {
        const id = it.id;
        const url = 'https://www.youtube.com/watch?v=' + id;

        // Dedup: skip if we already stored this exact URL (any status)
        const exist = await env.DB.prepare('SELECT id FROM videos WHERE url=?').bind(url).first();
        if (exist) continue;

        const sn = it.snippet || {};
        const title = (sn.title || 'Video').toString().slice(0, 300);
        const thumbs = sn.thumbnails || {};
        const cover = (thumbs.high && thumbs.high.url) ||
          (thumbs.medium && thumbs.medium.url) ||
          (thumbs.default && thumbs.default.url) ||
          ('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg');
        const channel = sn.channelTitle || '';

        const ts = Date.now();
        await env.DB.prepare(
          `INSERT INTO videos (company_id, url, platform, title, cover_url, embed_html, created_by, status, source, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(null, url, 'youtube', title, cover, ytEmbed(id), null, 'pending', 'youtube_api', ts, ts).run();
        inserted++;
      }
    } catch (e) {
      errors.push(kw + ': ' + (e && e.message ? e.message : 'exception'));
    }
  }

  return new Response(JSON.stringify({ ok: true, inserted, errors }), {
    headers: { 'content-type': 'application/json' }
  });
}
