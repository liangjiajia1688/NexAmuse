// NexAmuse — global middleware.
//
// 1) Guards the admin console server-side: an unauthenticated visitor never
//    receives admin HTML at all (previously /admin/ was served to anyone).
// 2) Injects the language switcher into public pages.
import { authAdmin } from './_lib/auth.js';

// Assets the login screen itself needs — must stay reachable while signed out.
// Both the .html form and its clean-URL alias (/admin/login) are included,
// because Pages 308-redirects /admin/login.html → /admin/login.
const ADMIN_PUBLIC = new Set([
  '/admin/login.html',
  '/admin/login',
  '/admin/login/',
  '/admin/admin.css',
  '/admin/admin.js',
]);

// Static assets carry no data; keeping them public avoids breaking the
// login page styling before a session exists.
const ASSET_RE = /\.(css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|map)$/i;

function isAdminPath(path) {
  return path === '/admin' || path === '/admin/' || path.startsWith('/admin/');
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // ── Admin console gate ─────────────────────────────────────────
  if (isAdminPath(path)) {
    if (ADMIN_PUBLIC.has(path) || ASSET_RE.test(path)) {
      return next();
    }

    const admin = await authAdmin(request, env);
    if (!admin) {
      // Browsers navigating to a page get bounced to the login screen.
      const accept = request.headers.get('Accept') || '';
      const wantsHtml = request.method === 'GET' && accept.includes('text/html');
      if (wantsHtml) {
        return Response.redirect(new URL('/admin/login.html', url).toString(), 302);
      }
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    // Admin pages must never be cached by browsers or intermediaries.
    const res = await next();
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    return new Response(res.body, { status: res.status, headers });
  }

  // ── Public pages: inject language switcher ────────────────────
  const response = await next();

  if (request.method !== 'GET') return response;
  if (path.startsWith('/api/')) return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const inject =
    '<link rel="stylesheet" href="/lang-switcher.css">\n' +
    '<script src="/lang-switcher.js" defer></script>';

  if (html.includes('</body>')) {
    html = html.replace('</body>', inject + '\n</body>');
  } else {
    html += '\n' + inject;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(html, { status: response.status, headers });
}
