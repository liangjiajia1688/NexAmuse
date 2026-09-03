import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);

  if (request.method === 'GET') {
    const threadsCount = await env.DB.prepare('SELECT COUNT(*) c FROM forum_threads WHERE user_id=?').bind(user.id).first();
    const repliesCount = await env.DB.prepare('SELECT COUNT(*) c FROM forum_replies WHERE user_id=?').bind(user.id).first();
    user.threads_count = threadsCount?.c || 0;
    user.replies_count = repliesCount?.c || 0;
    return json({ user });
  }

  if (request.method === 'PUT' || request.method === 'PATCH') {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }

    const username = (body.username || '').trim();
    // avatar is only touched when explicitly provided in the payload
    const avatar = (typeof body.avatar === 'string') ? body.avatar.trim() : undefined;
    const email = (typeof body.email === 'string') ? body.email.trim().toLowerCase() : '';

    if (username) {
      if (!/^[a-zA-Z0-9_\-\.]{3,32}$/.test(username)) {
        return fail('Username must be 3-32 characters and contain only letters, numbers, underscores, hyphens or dots');
      }
      const existing = await env.DB.prepare('SELECT id FROM users WHERE username=? AND id!=?').bind(username, user.id).first();
      if (existing) return fail('Username already taken', 409);
    }

    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail('Please enter a valid email address');
      }
      const existingEmail = await env.DB.prepare('SELECT id FROM users WHERE email=? AND id!=?').bind(email, user.id).first();
      if (existingEmail) return fail('Email already in use', 409);
    }

    if (avatar !== undefined && avatar && !/^https?:\/\/.+/i.test(avatar)) {
      return fail('Avatar must be a valid URL');
    }

    const fields = [];
    const values = [];
    if (username) { fields.push('username=?'); values.push(username); }
    if (email) { fields.push('email=?'); values.push(email); fields.push('email_verified=0'); }
    if (avatar !== undefined) { fields.push('avatar=?'); values.push(avatar || null); }
    if (fields.length === 0) return fail('No fields to update');

    values.push(user.id);
    const sql = 'UPDATE users SET ' + fields.join(', ') + ' WHERE id=?';
    await env.DB.prepare(sql).bind(...values).run();

    const updated = await env.DB.prepare('SELECT id,email,username,role,avatar,level,points,status,is_super,email_verified FROM users WHERE id=?').bind(user.id).first();
    return json({ user: updated });
  }

  return fail('Method not allowed', 405);
}
