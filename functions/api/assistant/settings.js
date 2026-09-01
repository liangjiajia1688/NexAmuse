import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

// Default Site Assistant configuration (used when no row exists yet).
export function defaultConfig() {
  return {
    enabled: true,
    name: 'Nex — Your Amusement Guide',
    avatar: '🤖',
    greeting: "Hello! 👋 I'm Nex, your personal guide to NexAmuse Global. How can I help you find the perfect amusement equipment today?",
    quickReplies: ['Browse VR Equipment', 'Find Suppliers', 'Upcoming Exhibitions'],
    enableAi: false,        // rule-based for now; flip to true once an AI key is wired
    showAllPages: true,
    requireLogin: false,
  };
}

function normalizeConfig(b) {
  const d = defaultConfig();
  if (!b || typeof b !== 'object') return d;
  const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : d.quickReplies);
  return {
    enabled: b.enabled !== false,
    name: String(b.name || d.name).slice(0, 60),
    avatar: String(b.avatar || d.avatar).slice(0, 4),
    greeting: String(b.greeting || d.greeting).slice(0, 400),
    quickReplies: arr(b.quickReplies).length ? arr(b.quickReplies) : d.quickReplies,
    enableAi: !!b.enableAi,
    showAllPages: b.showAllPages !== false,
    requireLogin: !!b.requireLogin,
  };
}

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const row = await env.DB.prepare('SELECT config FROM assistant_settings WHERE id=1').first();
    const cfg = row ? JSON.parse(row.config) : defaultConfig();
    return json(cfg);
  } catch (e) {
    return json(defaultConfig());
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (user.role !== 'admin' && !user.is_super) return fail('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid JSON', 400); }

  const cfg = normalizeConfig(body);
  await env.DB.prepare(
    'INSERT INTO assistant_settings (id, config, updated_at) VALUES (1, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET config=excluded.config, updated_at=excluded.updated_at'
  ).bind(JSON.stringify(cfg), now()).run();

  return json({ ok: true, config: cfg });
}
