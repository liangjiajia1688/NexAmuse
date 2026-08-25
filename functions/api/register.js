// 注册接口
import { hashPassword } from '../../src/lib/auth.js';
import { now, json, fail } from '../../src/lib/db.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return fail('请求格式错误'); }

  const { email, username, password, role } = body;
  if (!email || !username || !password) return fail('邮箱、用户名、密码均为必填');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('邮箱格式不正确');
  if (String(password).length < 6) return fail('密码至少 6 位');

  const r = role === 'company' ? 'company' : 'user';

  const exist = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exist) return fail('该邮箱已注册', 409);

  const { hash, salt } = await hashPassword(password);
  const res = await env.DB.prepare(
    'INSERT INTO users (email, username, password_hash, password_salt, role, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(email, username, hash, salt, r, now()).run();

  return json({ ok: true, userId: res.meta.last_row_id, role: r }, 201);
}
