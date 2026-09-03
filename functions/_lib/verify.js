const enc = new TextEncoder();

export function generateCode() {
  // 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function hashCode(code) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(code));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function codeExpiry(minutes = 15) {
  return Date.now() + minutes * 60 * 1000;
}

export function verifyEmailHtml(code, username) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Verify your NexAmuse account</title></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:Inter,system-ui,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid rgba(201,162,39,.2);border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;text-align:center;">
          <div style="font-family:'Playfair Display',serif;font-size:24px;color:#fff;">Nex<span style="color:#c9a227;">Amuse</span></div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Global Portal</div>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <h2 style="font-size:18px;color:#fff;margin:0 0 12px;">Verify your email</h2>
          <p style="font-size:14px;color:#9aa0b4;line-height:1.6;margin:0 0 24px;">Hi ${username || 'there'},<br>Your verification code is:</p>
          <div style="background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.3);border-radius:10px;padding:18px;text-align:center;letter-spacing:6px;font-size:28px;font-weight:700;color:#f5d06e;margin-bottom:24px;">${code}</div>
          <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:0;">This code expires in 15 minutes. If you did not create an account, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
