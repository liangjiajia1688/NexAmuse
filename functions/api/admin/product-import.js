import { json, fail, now } from '../../_lib/db.js';
import { authUser } from '../../_lib/auth.js';
import { uploadToTutu } from '../../_lib/tutu.js';

// Bulk product import for admins (helping suppliers onboard).
//   action=parse-text   { text }                  -> AI turns raw supplier text into structured products
//   action=fetch-link   { url }                   -> Shopify / WooCommerce / JSON-LD / OG adapters
//   action=commit       { company_id, products[] } -> insert as 'pending' + re-host images
//
// Costs are bounded: commit handles at most MAX_PRODUCTS per call, MAX_IMAGES each,
// so subrequests stay well below the Workers limit. The page chunks larger batches.

const CATEGORIES = [
  'Arcade Machines',
  'VR / XR Attractions',
  'Kids & Family Rides',
  'Redemption Games',
  'Simulation Rides',
  'Outdoor Attractions',
  'Water Park Equipment',
  'Payment Technology',
  'Accessories & Parts'
];

const MAX_PRODUCTS = 5;
const MAX_IMAGES = 4;
const UA = 'Mozilla/5.0 (compatible; NexAmuseBot/1.0; +https://nexamuse.pages.dev)';

// ---------- helpers ----------

function slugify(text) {
  return String(text || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');
}

function stripHtml(h) {
  return String(h || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const KEYWORDS = [
  ['virtual reality', 'VR / XR Attractions'], ['vr ', 'VR / XR Attractions'],
  [' xr ', 'VR / XR Attractions'], ['arcade', 'Arcade Machines'],
  ['claw machine', 'Redemption Games'], ['redemption', 'Redemption Games'],
  ['prize', 'Redemption Games'], ['ticket', 'Redemption Games'],
  ['carousel', 'Kids & Family Rides'], ['kids', 'Kids & Family Rides'],
  ['kiddie', 'Kids & Family Rides'], ['train ride', 'Kids & Family Rides'],
  ['simulator', 'Simulation Rides'], ['simulation', 'Simulation Rides'],
  ['racing', 'Simulation Rides'], ['flight', 'Simulation Rides'],
  ['playground', 'Kids & Family Rides'], ['outdoor', 'Outdoor Attractions'],
  ['water slide', 'Water Park Equipment'], ['water park', 'Water Park Equipment'],
  ['wave pool', 'Water Park Equipment'], ['pool', 'Water Park Equipment'],
  ['payment', 'Payment Technology'], ['card reader', 'Payment Technology'],
  ['token', 'Payment Technology'], ['pos ', 'Payment Technology'],
  ['spare part', 'Accessories & Parts'], ['accessory', 'Accessories & Parts'],
  ['accessories', 'Accessories & Parts']
];

function matchCategory(raw) {
  if (!raw) return '';
  const s = String(raw).toLowerCase().trim();
  for (const c of CATEGORIES) {
    if (c.toLowerCase() === s) return c;
  }
  for (const [k, v] of KEYWORDS) {
    if (s.includes(k)) return v;
  }
  return '';
}

function absUrl(u, origin) {
  if (!u) return '';
  let s = String(u).trim();
  if (!s) return '';
  if (s.startsWith('//')) s = 'https:' + s;
  try { return new URL(s, origin).href; } catch (e) { return ''; }
}

// Images already hosted on our own image host must not be re-downloaded/re-uploaded.
function isOwnHost(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === 'tutu.to' || h.endsWith('.tutu.to');
  } catch (e) { return false; }
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// SSRF guard: admins may only pull from public http(s) endpoints.
function urlGuard(raw) {
  let u;
  try { u = new URL(String(raw)); } catch (e) { return 'Invalid URL'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Only http/https URLs are supported';
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) {
    return 'Blocked host';
  }
  if (h === '::1' || h === '[::1]' || h.startsWith('fd') || h.startsWith('fc') || h.startsWith('fe80')) {
    return 'Blocked host';
  }
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a === 0 || a === 10 || a === 127) return 'Blocked IP';
    if (a === 192 && b === 168) return 'Blocked IP';
    if (a === 172 && b >= 16 && b <= 31) return 'Blocked IP';
    if (a === 169 && b === 254) return 'Blocked IP';
    if (a >= 224) return 'Blocked IP';
  }
  return null;
}

async function httpText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

// ---------- LLM ----------

async function llmJson(env, systemPrompt, userPrompt) {
  const API_KEY = env.AI_API_KEY;
  if (!API_KEY) return { error: 'AI_API_KEY not configured' };
  const BASE = env.AI_BASE_URL || 'https://api.openai.com/v1';
  const PRIMARY = env.AI_MODEL || 'gpt-4o-mini';
  const FALLBACK = ['minimax/minimax-m3:free', 'z-ai/glm-5.2:free', 'google/gemma-4-26b-a4b-it:free'];
  const MODELS = Array.from(new Set([PRIMARY, ...FALLBACK]));
  let lastErr = '';
  for (const model of MODELS) {
    try {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.2
        })
      });
      if (!r.ok) { lastErr = `${model}: HTTP ${r.status}`; continue; }
      const d = await r.json();
      let raw = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
      raw = String(raw).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      return { data: JSON.parse(raw) };
    } catch (e) {
      lastErr = `${model}: ${e.message}`;
    }
  }
  return { error: lastErr || 'AI service unavailable' };
}

// ---------- link adapters ----------

function mapShopify(p) {
  const v = (p.variants && p.variants[0]) || {};
  const imgs = (p.images || []).map(i => i && (i.src || i.url)).filter(Boolean).slice(0, 8);
  return {
    name: p.title || '',
    category: matchCategory(p.product_type),
    description: stripHtml(p.body_html).slice(0, 4000),
    price: v.price ? 'US$' + v.price : '',
    moq: '',
    images: imgs,
    tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '')
  };
}

async function tryShopify(u) {
  const origin = u.origin;
  const m = u.pathname.match(/\/products\/([A-Za-z0-9_%.-]+)/);
  let handle = '';
  if (m) { try { handle = decodeURIComponent(m[1]); } catch (e) { handle = m[1]; } }

  // Prefer the catalogue endpoint: it carries body_html and full image lists,
  // while the per-product .js endpoint is often trimmed down by the theme.
  let all = null;
  try {
    all = (JSON.parse(await httpText(`${origin}/products.json?limit=250`)).products) || [];
  } catch (e) { all = null; }

  if (all) {
    if (handle) {
      const hit = all.find(p => p.handle === handle);
      if (hit) return [mapShopify(hit)];
    } else if (all.length) {
      return all.map(mapShopify);
    }
  }
  if (handle) {
    return [mapShopify(JSON.parse(await httpText(`${origin}/products/${handle}.js`)))];
  }
  return [];
}

async function tryWoo(u) {
  const origin = u.origin;
  const m = u.pathname.match(/\/product\/([A-Za-z0-9_%.-]+)/);
  const url = m
    ? `${origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(m[1])}`
    : `${origin}/wp-json/wc/store/v1/products?per_page=50`;
  const j = JSON.parse(await httpText(url));
  if (!Array.isArray(j)) throw new Error('unexpected WooCommerce response');
  return j.map(p => ({
    name: stripHtml(p.name),
    category: matchCategory((p.categories && p.categories[0] && p.categories[0].name) || ''),
    description: stripHtml(p.description || p.short_description || '').slice(0, 4000),
    price: p.price ? String(p.price) : '',
    moq: '',
    images: (p.images || []).map(i => i && (i.src || i.thumbnail)).filter(Boolean).slice(0, 8),
    tags: ''
  }));
}

function findProducts(obj, out, depth) {
  if (!out) out = [];
  if (depth === undefined) depth = 0;
  if (depth > 6 || !obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    for (const o of obj) findProducts(o, out, depth + 1);
    return out;
  }
  const t = obj['@type'];
  const types = Array.isArray(t) ? t : [t];
  if (types.some(x => String(x).toLowerCase() === 'product')) out.push(obj);
  for (const key of ['@graph', 'itemListElement', 'item', 'mainEntity', 'hasVariant']) {
    if (obj[key]) findProducts(obj[key], out, depth + 1);
  }
  return out;
}

function jsonLdImages(v, origin) {
  const out = [];
  const push = x => {
    if (typeof x === 'string') out.push(x);
    else if (x && typeof x === 'object' && x.url) out.push(x.url);
  };
  if (Array.isArray(v)) v.forEach(push); else push(v);
  return out.map(u => absUrl(u, origin)).filter(Boolean).slice(0, 8);
}

function jsonLdPrice(offers) {
  const o = Array.isArray(offers) ? offers[0] : offers;
  if (!o || typeof o !== 'object') return '';
  const p = (o.price !== undefined && o.price !== null) ? o.price : o.lowPrice;
  if (p === undefined || p === null || p === '') return '';
  return (o.priceCurrency ? o.priceCurrency + ' ' : '') + p;
}

function meta(html, prop) {
  let m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*?content=["\']([^"\']*)["\']', 'i'));
  if (m) return m[1];
  m = html.match(new RegExp('<meta[^>]+?content=["\']([^"\']*)["\'][^>]*?(?:property|name)=["\']' + prop + '["\']', 'i'));
  return m ? m[1] : '';
}

async function tryGeneric(u) {
  const html = await httpText(u.href);
  const origin = u.origin;
  const out = [];

  // 1) schema.org JSON-LD (published by the site for search engines)
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    const inner = b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    let j;
    try { j = JSON.parse(inner); } catch (e) { continue; }
    const found = findProducts(j, [], 0);
    for (const p of found) {
      const name = typeof p.name === 'string' ? p.name : '';
      if (!name) continue;
      const brand = (p.brand && (p.brand.name || p.brand)) || '';
      out.push({
        name: stripHtml(name),
        category: matchCategory(p.category || ''),
        description: stripHtml(p.description || '').slice(0, 4000),
        price: jsonLdPrice(p.offers),
        moq: '',
        images: jsonLdImages(p.image, origin),
        tags: typeof brand === 'string' ? brand : ''
      });
    }
    if (out.length) return { source: 'jsonld', products: out };
  }

  // 2) OpenGraph fallback
  const ogTitle = meta(html, 'og:title');
  const ogImg = meta(html, 'og:image');
  if (ogTitle) {
    const amt = meta(html, 'product:price:amount');
    const cur = meta(html, 'product:price:currency');
    return {
      source: 'og',
      products: [{
        name: stripHtml(ogTitle),
        category: matchCategory(meta(html, 'product:category') || ogTitle),
        description: stripHtml(meta(html, 'og:description')).slice(0, 4000),
        price: amt ? (cur ? cur + ' ' + amt : amt) : '',
        moq: '',
        images: ogImg ? [absUrl(ogImg, origin)] : [],
        tags: ''
      }]
    };
  }
  return null;
}

// ---------- main ----------

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  if (!(user.role === 'admin' || user.is_super)) return fail('Admin required', 403);

  let b;
  try { b = await request.json(); } catch (e) { return fail('Invalid JSON', 400); }
  const action = b.action || '';

  // ---- AI: free text -> structured products ----
  if (action === 'parse-text') {
    const text = String(b.text || '').trim();
    if (!text) return fail('Text is required');
    if (text.length > 12000) return fail('Text is too long (max 12000 characters)');
    const system = [
      'You extract structured product data for an amusement / FEC equipment B2B marketplace.',
      'Always answer with STRICT JSON only, no markdown fences, no commentary.',
      'Shape: {"products":[{"name","category","short_description","description","price","moq",',
      '"dimensions","weight","power_supply","power_consumption","min_players","max_players",',
      '"age_range","certification","tags"}]}',
      'Category MUST be one of: ' + CATEGORIES.join(' | ') + ' (pick the closest match).',
      'Normalise and translate everything into natural English.',
      'Use empty strings for unknown fields. min_players/max_players must be numbers or empty.',
      'If the text describes more than one product, return one entry per product.'
    ].join(' ');
    const r = await llmJson(env, system, text);
    if (r.error) return json({ ok: false, error: r.error }, 200);
    const list = Array.isArray(r.data && r.data.products) ? r.data.products : [];
    const products = list.map(p => ({
      name: String(p.name || '').trim(),
      category: matchCategory(p.category) || '',
      short_description: String(p.short_description || '').trim(),
      description: String(p.description || '').trim(),
      price: String(p.price || '').trim(),
      moq: String(p.moq || '').trim(),
      dimensions: String(p.dimensions || '').trim(),
      weight: String(p.weight || '').trim(),
      power_supply: String(p.power_supply || '').trim(),
      power_consumption: String(p.power_consumption || '').trim(),
      min_players: p.min_players === '' || p.min_players == null ? null : parseInt(p.min_players, 10) || null,
      max_players: p.max_players === '' || p.max_players == null ? null : parseInt(p.max_players, 10) || null,
      age_range: String(p.age_range || '').trim(),
      certification: String(p.certification || '').trim(),
      tags: String(p.tags || '').trim(),
      images: []
    })).filter(p => p.name);
    return json({ ok: true, products });
  }

  // ---- link import via adapters ----
  if (action === 'fetch-link') {
    const rawUrl = String(b.url || '').trim();
    if (!rawUrl) return fail('URL is required');
    const blocked = urlGuard(rawUrl);
    if (blocked) return json({ ok: false, supported: false, reason: blocked }, 200);

    let u;
    try { u = new URL(rawUrl); } catch (e) { return fail('Invalid URL'); }

    const attempts = [];
    // Shopify and WooCommerce expose public, documented endpoints - try them first.
    try {
      const prods = await tryShopify(u);
      if (prods && prods.length) return json({ ok: true, supported: true, source: 'shopify', products: prods });
      attempts.push('shopify: no products');
    } catch (e) { attempts.push('shopify: ' + e.message); }
    try {
      const prods = await tryWoo(u);
      if (prods && prods.length) return json({ ok: true, supported: true, source: 'woocommerce', products: prods });
      attempts.push('woocommerce: no products');
    } catch (e) { attempts.push('woocommerce: ' + e.message); }
    try {
      const res = await tryGeneric(u);
      if (res && res.products.length) {
        return json({ ok: true, supported: true, source: res.source, products: res.products });
      }
      attempts.push('generic: no structured data');
    } catch (e) { attempts.push('generic: ' + e.message); }

    // Unsupported (Alibaba, 1688, Made-in-China, login walls...) -> degrade gracefully,
    // never promise a scrape that we cannot keep working.
    return json({
      ok: true,
      supported: false,
      reason: 'This site does not expose machine-readable product data. Large marketplaces (Alibaba, 1688, Made-in-China) also block automated access, so we do not scrape them.',
      hint: 'Use the Excel/CSV template or paste the product text and let AI structure it.',
      attempts
    }, 200);
  }

  // ---- commit: insert as pending + re-host images ----
  if (action === 'commit') {
    const companyId = parseInt(b.company_id || '0', 10);
    if (!companyId) return fail('company_id is required');
    const list = Array.isArray(b.products) ? b.products : [];
    if (!list.length) return fail('No products to import');

    const company = await env.DB.prepare('SELECT id, owner_id FROM companies WHERE id=?').bind(companyId).first();
    if (!company) return fail('Company not found', 404);
    const ownerId = company.owner_id || user.id;

    const chunk = list.slice(0, MAX_PRODUCTS);
    const ts = now();
    const results = [];

    for (const p of chunk) {
      const name = String(p.name || '').trim();
      if (!name) { results.push({ ok: false, name: '', error: 'Missing product name' }); continue; }
      try {
        const slug = (slugify(name) || 'product') + '-' + Date.now() + Math.floor(Math.random() * 1000);
        const ins = await env.DB.prepare(
          `INSERT INTO company_products (
             company_id, owner_id, name, slug, category, description, short_description,
             price, moq, image, status, featured, created_at, updated_at,
             tags, dimensions, weight, power_supply, power_consumption,
             min_players, max_players, age_range, certification, additional_specs, visibility
           ) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',0,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          companyId,
          ownerId,
          name,
          slug,
          matchCategory(p.category) || '',
          String(p.description || '').slice(0, 8000),
          String(p.short_description || '').slice(0, 500),
          String(p.price || '').slice(0, 100),
          String(p.moq || '').slice(0, 100),
          '',
          ts,
          ts,
          String(p.tags || '').slice(0, 300),
          String(p.dimensions || '').slice(0, 200),
          String(p.weight || '').slice(0, 100),
          String(p.power_supply || '').slice(0, 100),
          String(p.power_consumption || '').slice(0, 100),
          p.min_players === '' || p.min_players == null ? null : parseInt(p.min_players, 10) || null,
          p.max_players === '' || p.max_players == null ? null : parseInt(p.max_players, 10) || null,
          String(p.age_range || '').slice(0, 100),
          String(p.certification || '').slice(0, 200),
          String(p.additional_specs || '').slice(0, 4000),
          'all' // public /api/products only exposes visibility NULL/''/'all'
        ).run();

        const pid = ins.meta && ins.meta.last_row_id;
        const urls = (Array.isArray(p.images) ? p.images : []).filter(Boolean).slice(0, MAX_IMAGES);
        let first = '';
        let hosted = 0;
        const imgErrors = [];

        for (let i = 0; i < urls.length; i++) {
          const raw = String(urls[i]).trim();
          let finalUrl = raw;
          if (raw && !isOwnHost(raw)) {
            try {
              const ir = await fetch(raw, { headers: { 'User-Agent': UA } });
              if (ir.ok) {
                finalUrl = await uploadToTutu(toBase64(await ir.arrayBuffer()), env.TUTU_API_KEY);
                hosted++;
              } else {
                imgErrors.push(raw + ' (HTTP ' + ir.status + ')');
              }
            } catch (e) {
              imgErrors.push(raw + ' (' + e.message + ')');
            }
          } else if (raw) {
            hosted++;
          }
          if (raw) {
            await env.DB.prepare(
              'INSERT INTO product_images (product_id, image_type, original_url, compressed_url, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
            ).bind(pid, 'product', raw, finalUrl, i, ts, ts).run();
            if (!first) first = finalUrl;
          }
        }
        if (first) {
          await env.DB.prepare('UPDATE company_products SET image=? WHERE id=?').bind(first, pid).run();
        }
        results.push({ ok: true, id: pid, name, images: urls.length, hosted, imgErrors });
      } catch (e) {
        results.push({ ok: false, name, error: e.message || 'Insert failed' });
      }
    }

    return json({
      ok: true,
      results,
      imported: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      remaining: Math.max(0, list.length - chunk.length)
    });
  }

  return fail('Unknown action', 400);
}
