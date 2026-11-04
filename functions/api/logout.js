import { clearSessionCookie, tokenFromRequest, verifyToken } from '../_lib/auth.js';

// POST /api/logout — clears the session cookie AND revokes the token
// server-side by bumping the user's token_version, so a copied cookie or
// stolen bearer token stops working immediately.
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    const token = tokenFromRequest(request);
    if (token) {
      const claim = await verifyToken(token, env.TOKEN_SECRET);
      if (claim) {
        await env.DB.prepare(
          'UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?'
        ).bind(claim.uid).run();
      }
    }
  } catch (e) { /* always clear the cookie even if revocation fails */ }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearSessionCookie(url)
    }
  });
}
