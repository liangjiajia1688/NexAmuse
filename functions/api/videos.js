import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';
import { uploadToTutu } from '../_lib/tutu.js';

// ── helpers ────────────────────────────────────────────────────────────────
function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function detectPlatform(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com') || u.includes('instagram.com')) return 'instagram';
  return 'other';
}

function youtubeId(url) {
  const m = (url || '').match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// Download a remote cover image and host it on tutu.to so it never 404s if the
// source deletes it. Falls back to the original remote URL on any failure.
async function hostCover(coverUrl, env) {
  if (!coverUrl) return null;
  try {
    const cr = await fetch(coverUrl, { redirect: 'follow' });
    if (!cr.ok) return coverUrl;
    const buf = await cr.arrayBuffer();
    return await uploadToTutu(toBase64(buf), env.TUTU_API_KEY);
  } catch (e) {
    return coverUrl;
  }
}

// Best-effort metadata extraction (server-side, no CORS limits).
// Order: platform oEmbed → OpenGraph scrape → URL hostname as title.
async function ingestVideo(url, env) {
  const platform = detectPlatform(url);
  let title = null, cover = null, embed = null;

  try {
    if (platform === 'youtube') {
      const id = youtubeId(url);
      const oe = await fetch(
        'https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json'
      ).then(r => (r.ok ? r.json() : null)).catch(() => null);
      if (oe) { title = oe.title || null; cover = oe.thumbnail_url || null; }
      if (!cover && id) cover = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
      if (id) embed =
        '<iframe width="100%" height="100%" src="https://www.youtube.com/embed/' + id +
        '" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    } else if (platform === 'vimeo') {
      const oe = await fetch(
        'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(url)
      ).then(r => (r.ok ? r.json() : null)).catch(() => null);
      if (oe) { title = oe.title || null; cover = oe.thumbnail_url || null; embed = oe.html || null; }
    } else if (platform === 'tiktok') {
      const oe = await fetch(
        'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url)
      ).then(r => (r.ok ? r.json() : null)).catch(() => null);
      if (oe) { title = oe.title || null; cover = oe.thumbnail_url || null; embed = oe.html || null; }
    }
  } catch (e) { /* best-effort */ }

  // Fallback: scrape OpenGraph tags from the page itself.
  if (!title || !cover) {
    try {
      const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
        .then(r => (r.ok ? r.text() : '')).catch(() => '');
      const og = (name) => {
        const m = html.match(
          new RegExp('<meta[^>]+property=["\']og:' + name + '["\'][^>]+content=["\']([^"\']+)["\']', 'i')
        ) || html.match(
          new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:' + name + '["\']', 'i')
        );
        return m ? m[1] : null;
      };
      if (!title) title = og('title');
      if (!cover) cover = og('image');
    } catch (e) { /* ignore */ }
  }

  if (!title) { try { title = new URL(url).hostname; } catch (e) { title = 'Video'; } }
  const cover_url = await hostCover(cover, env);
  return { platform, title: title ? String(title).slice(0, 300) : 'Video', cover_url, embed_html: embed };
}

// ── route ────────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET /api/videos?company_id=&limit=  (public)
  if (request.method === 'GET') {
    const company_id = url.searchParams.get('company_id');
    const limit = Math.min(60, parseInt(url.searchParams.get('limit') || '24', 10));
    let rows;
    if (company_id) {
      rows = await env.DB.prepare(
        "SELECT * FROM videos WHERE status='active' AND company_id=? ORDER BY created_at DESC LIMIT ?"
      ).bind(company_id, limit).all();
    } else {
      rows = await env.DB.prepare(
        "SELECT * FROM videos WHERE status='active' ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();
    }
    return json({ ok: true, videos: rows.results || [] });
  }

  // POST /api/videos  { url, company_id? }  (auth)
  if (request.method === 'POST') {
    const user = await authUser(request, env);
    if (!user) return fail('Unauthorized', 401);
    const isAdmin = user.role === 'admin' || user.is_super === 1;

    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
    const link = (body.url || '').trim();
    if (!link || !/^https?:\/\//i.test(link)) return fail('A valid video URL is required');

    let companyId = body.company_id ? parseInt(body.company_id, 10) : null;
    if (companyId) {
      const c = await env.DB.prepare('SELECT owner_id FROM companies WHERE id=?').bind(companyId).first();
      if (!c) return fail('Company not found', 404);
      if (!isAdmin && c.owner_id !== user.id) return fail('Not allowed to add videos to this company', 403);
    }

    const meta = await ingestVideo(link, env);
    const ts = Date.now();
    const res = await env.DB.prepare(
      `INSERT INTO videos (company_id, url, platform, title, cover_url, embed_html, created_by, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,'active',?,?)`
    ).bind(companyId, link, meta.platform, meta.title, meta.cover_url, meta.embed_html, user.id, ts, ts).run();

    const id = res.meta && res.meta.last_row_id;
    const row = await env.DB.prepare('SELECT * FROM videos WHERE id=?').bind(id).first();
    return json({ ok: true, video: row });
  }

  return fail('Method not allowed', 405);
}
