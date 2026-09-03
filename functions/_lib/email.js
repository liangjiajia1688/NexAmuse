// Email sender wrapper. Uses Resend (https://resend.com) free tier by default.
// Set RESEND_API_KEY in Cloudflare Pages environment variables. If not set,
// sendEmail returns {dev:true} so callers can fall back to a dev/test mode.

export async function sendEmail({ to, subject, html, text }, env) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set; skipping real send to', to);
    return { ok: false, dev: true, message: 'RESEND_API_KEY not configured' };
  }

  const from = env.EMAIL_FROM || 'NexAmuse <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
