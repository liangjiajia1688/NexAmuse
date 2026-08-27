import { json, fail, now } from '../_lib/db.js';
import { hashPassword, makeToken } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  let body;
  try { body = await request.json(); } catch (e) { return fail('Invalid JSON'); }
  const email = (body.email || '').trim().toLowerCase();
  const username = (body.username || '').trim();
  const password = body.password || '';
  if (!email || !username || !password) return fail('Email, username and password are required');
  if (password.length < 6) return fail('Password must be at least 6 characters');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Invalid email');

  const existsEmail = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (existsEmail) return fail('Email already registered', 409);
  const existsUser = await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first();
  if (existsUser) return fail('Username already taken', 409);

  const hash = await hashPassword(password);
  const res = await env.DB.prepare(
    'INSERT INTO users (email,username,password,role,level,status,points,created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(email, username, hash, 'user', 'Standard', 'active', 1, now()).run();
  const userId = res.meta && res.meta.last_row_id;
  const token = await makeToken(userId, env.TOKEN_SECRET);
  return json({ token, user: { id: userId, email, username, role: 'user', level: 'Standard', status: 'active', points: 1 } }, 201);
}
