// Shared YouTube industry-video aggregation logic.
// Used by both the Cron Trigger (functions/scheduled-video-aggregation.js)
// and the manual HTTP trigger (functions/api/cron/aggregate-videos.js).
//
// Official YouTube Data API v3 only — no scraping. Candidates are stored with
// status='pending' + source='youtube_api'; an admin must approve them in
// /admin/videos.html before they appear on the public Videos page.
// Quota budget: ~10 keywords * ~101 units ≈ 1,010 units/day (< 10,000 free cap).

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

export async function runAggregation(env) {
  const KEY = env.YOUTUBE_API_KEY;
  if (!KEY) return { ok: false, error: 'YOUTUBE_API_KEY not set', inserted: 0, errors: [] };

  let inserted = 0;
  const errors = [];

  for (const kw of KEYWORDS) {
    try {
      // 1) search.list — find recent, relevant public videos (100 units)
      const searchUrl = 'https://www.googleapis.com/youtube/v3/search?part=snippet' +
        '&type=video&maxResults=5&order=date&relevanceLanguage=en' +
        '&q=' + encodeURIComponent(kw) + '&key=' + KEY;
      const sr = await fetch(searchUrl).then(r => r.json());
      if (sr.error) { errors.push(kw + ': ' + (sr.error.message || 'search error')); continue; }
      const ids = (sr.items || [])
        .map(i => (i.id && i.id.videoId) ? i.id.videoId : null)
        .filter(Boolean);
      if (!ids.length) continue;

      // 2) videos.list — fetch metadata (1 unit, batched up to 50)
      const vidUrl = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics' +
        '&id=' + ids.join(',') + '&key=' + KEY;
      const vr = await fetch(vidUrl).then(r => r.json());
      if (vr.error) { errors.push(kw + ': ' + (vr.error.message || 'videos error')); continue; }

      for (const it of (vr.items || [])) {
        const id = it.id;
        const url = 'https://www.youtube.com/watch?v=' + id;
        const exist = await env.DB.prepare('SELECT id FROM videos WHERE url=?').bind(url).first();
        if (exist) continue;

        const sn = it.snippet || {};
        const title = (sn.title || 'Video').toString().slice(0, 300);
        const thumbs = sn.thumbnails || {};
        const cover = (thumbs.high && thumbs.high.url) ||
          (thumbs.medium && thumbs.medium.url) ||
          (thumbs.default && thumbs.default.url) ||
          ('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg');

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

  return { ok: true, inserted, errors };
}
