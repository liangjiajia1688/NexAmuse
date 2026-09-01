import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';

const SECTIONS = ['site', 'seo', 'email', 'api'];

const DEFAULTS = {
  site: {
    siteName: 'NexAmuse Global',
    tagline: "The World's Premier Amusement B2B Platform",
    contactEmail: 'info@nexamuseglobal.com',
    supportEmail: 'support@nexamuseglobal.com',
    phone: '+1 (888) 639-2683',
    language: 'English',
    address: '123 Amusement Blvd, Las Vegas, NV 89101, USA',
  },
  seo: {
    gaId: '',
    gtmId: '',
    metaDescription:
      'NexAmuse Global is the world’s leading B2B marketplace for amusement and entertainment equipment, connecting buyers and suppliers across 60+ countries.',
  },
  email: {
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    encryption: 'TLS',
    fromName: 'NexAmuse Global',
  },
  api: {
    aiKey: '',
    mapsKey: '',
    stripeKey: '',
    wechatAppid: '',
    wechatSecret: '',
  },
};

// Merge helper: empty-string values never overwrite an existing stored value
// (so leaving a password field blank keeps the previously saved secret).
function mergeSection(existing, incoming) {
  const out = Object.assign({}, existing);
  for (const k of Object.keys(incoming || {})) {
    const v = incoming[k];
    if (v === '' && k in out && out[k] !== '') continue;
    out[k] = v;
  }
  return out;
}

async function readSection(env, section) {
  const row = await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind(section).first();
  if (!row) return DEFAULTS[section] || {};
  try { return Object.assign({}, DEFAULTS[section], JSON.parse(row.value)); }
  catch (e) { return DEFAULTS[section] || {}; }
}

export async function onRequestGet(context) {
  const { env } = context;
  const user = await authUser(context.request, env);
  if (!user) return fail('Unauthorized', 401);
  if (user.role !== 'admin' && !user.is_super) return fail('Forbidden', 403);
  const out = {};
  for (const s of SECTIONS) out[s] = await readSection(env, s);
  return json(out);
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (user.role !== 'admin' && !user.is_super) return fail('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid JSON', 400); }
  const section = body.section;
  if (!SECTIONS.includes(section)) return fail('Unknown section: ' + section, 400);
  const data = body.data && typeof body.data === 'object' ? body.data : {};

  const merged = mergeSection(await readSection(env, section), data);
  await env.DB.prepare(
    'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at'
  ).bind(section, JSON.stringify(merged), now()).run();

  return json({ ok: true, section, data: merged });
}
