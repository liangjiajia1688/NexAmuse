// NexAmuse — inject the language switcher into all public (non-admin) HTML pages.
export async function onRequest(context) {
  const { request, next } = context;
  const response = await next();

  if (request.method !== 'GET') return response;

  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith('/api/') || path.startsWith('/admin/')) return response;

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
