import { json, fail, now } from '../../_lib/db.js';
import { authUser, verifyPassword, hashPassword } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (user.role !== 'admin' && !user.is_super) return fail('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid JSON', 400); }
  const current = String(body.current || '');
  const next = String(body.next || '');
  const confirm = String(body.confirm || '');

  if (!current || !next || !confirm) return fail('All fields are required');
  if (next.length < 8) return fail('New password must be at least 8 characters');
  if (next !== confirm) return fail('New passwords do not match');

  const row = await env.DB.prepare('SELECT password FROM users WHERE id=?').bind(user.id).first();
  if (!row) return fail('Account not found', 404);
  if (!await verifyPassword(current, row.password)) return fail('Current password is incorrect', 400);

  const hashed = await hashPassword(next);
  await env.DB.prepare('UPDATE users SET password=?, updated_at=? WHERE id=?')
    .bind(hashed, now(), user.id).run();

  return json({ ok: true, message: 'Password updated successfully' });
}
