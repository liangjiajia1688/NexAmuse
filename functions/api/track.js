import { json } from '../_lib/db.js';

// POST /api/track — lightweight page-view beacon for analytics.
export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = request.headers;
  const ip = headers.get('CF-Connecting-IP') || headers.get('X-Forwarded-For') || '0.0.0.0';
  const country = headers.get('CF-IPCountry') || 'XX';
  const ua = headers.get('User-Agent') || '';
  const referrer = headers.get('Referer') || '';
  const url = new URL(request.url);
  const origin = url.origin;

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const path = body.path || url.searchParams.get('path') || '/';

  const isBot = /bot|crawler|spider|crawling|slurp|bingpreview|whatsapp|facebookexternalhit/i.test(ua) ? 1 : 0;
  let device = 'desktop';
  if (/Mobi/i.test(ua)) device = 'mobile';
  else if (/Tablet|iPad|Android(?!.*Mobi)/i.test(ua)) device = 'tablet';

  let source = 'direct';
  if (referrer && !referrer.startsWith(origin)) {
    try {
      source = new URL(referrer).hostname.replace(/^www\./, '') || 'direct';
    } catch (e) {
      source = 'unknown';
    }
  } else if (referrer) {
    source = 'internal';
  }

  try {
    await env.DB.prepare(
      'INSERT INTO visits (path, referrer, country, ip, ua, device, is_bot, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(path, referrer, country, ip, ua, device, isBot, source, Date.now()).run();
  } catch (e) {
    // silently ignore duplicate/errors so beacon never breaks the page
  }

  return json({ ok: true });
}
