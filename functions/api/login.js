// 登录接口
import { verifyPassword, signToken } from '../../src/lib/auth.js';
import { json, fail } from '../../src/lib/db.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return fail('请求格式错误'); }

  const { email, password } = body;
  if (!email || !password) return fail('邮箱和密码必填');

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user) return fail('邮箱或密码错误', 401);

  const ok = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!ok) return fail('邮箱或密码错误', 401);

  const token = await signToken({ uid: user.id, role: user.role }, env.TOKEN_SECRET);
  return json({
    ok: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, email: user.email },
  });
}
