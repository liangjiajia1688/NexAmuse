import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';

const LENGTH_GUIDE = {
  short:   { words: 350,  sections: 2 },
  medium:  { words: 700,  sections: 3 },
  long:    { words: 1200, sections: 5 },
  feature: { words: 2000, sections: 7 },
};

const STYLE_GUIDE = {
  professional: 'a professional B2B tone aimed at amusement operators, investors and suppliers',
  news: 'a news-report tone with timely industry framing',
  editorial: 'an opinionated editorial tone that challenges operators',
  guide: 'a practical how-to guide with actionable steps',
  listicle: 'a listicle (e.g. "7 ways to…") with scannable points',
  analysis: 'a data-driven market analysis with figures and projections',
};

function buildPrompt({ topic, style, length, keywords, brand, options, category }) {
  const L = LENGTH_GUIDE[length] || LENGTH_GUIDE.medium;
  const styleText = STYLE_GUIDE[style] || STYLE_GUIDE.professional;
  const kw = (keywords || '').trim();
  const opts = options || {};

  const sys = `You are a senior B2B content writer for "NexAmuse Global", a leading English-language intelligence platform for the global amusement / family-entertainment (FEC) / arcade / attraction industry. Write original, factual, non-repetitive articles. Never invent fake statistics; if you include numbers, phrase them as industry observations. Use clean HTML: <h2> for section headings, <p> for paragraphs, <ul><li> for lists, and <blockquote> for a short pull-quote. Do NOT wrap the whole response in a code block. Return ONLY a JSON object with these exact keys: title, excerpt, content, metaTitle, metaDesc, metaKeywords, category.`;

  const user = `Write ONE complete article with the following spec:
- Topic: "${topic}"
- Style: ${styleText}
- Target length: about ${L.words} words across roughly ${L.sections} sections.
- Category (use this value for "category"): ${category || 'Industry News'}
- Focus keywords to weave in naturally: ${kw || 'amusement park, FEC, arcade, entertainment equipment, VR'}
- Brand to reference where natural: ${brand || 'NexAmuse Global'}
${opts.cta ? `- Include a closing "Get Expert Guidance" section that softly promotes ${brand || 'NexAmuse Global'} as a supplier/insight connector.\n` : ''}${opts.stats ? `- Include concrete industry observations / benchmarks where relevant.\n` : ''}
Return JSON where:
- title: an SEO-friendly, click-worthy headline (<= 70 chars)
- excerpt: 1-2 sentence summary (<= 200 chars)
- content: full HTML article body (include the brand only where natural)
- metaTitle: <= 60 chars
- metaDesc: <= 160 chars, includes the focus keywords
- metaKeywords: comma-separated, <= 12 terms
- category: exactly "${category || 'Industry News'}"`;

  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

function stripHtml(s) { return (s || '').replace(/<[^>]+>/g, ''); }

function computeSeo(a) {
  let score = 60;
  const title = stripHtml(a.title || '');
  const desc = stripHtml(a.metaDesc || '');
  const kw = (a.metaKeywords || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (title.length >= 8 && title.length <= 70) score += 12;
  if (desc.length >= 50 && desc.length <= 160) score += 12;
  const body = stripHtml(a.content || '').toLowerCase();
  kw.forEach(k => { if (k && body.includes(k.toLowerCase())) score += 2; });
  const len = stripHtml(a.content || '').split(/\s+/).filter(Boolean).length;
  if (len >= 500) score += 8; if (len >= 1000) score += 6;
  return Math.max(40, Math.min(99, score));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = authUser(request, env);
  if (!user) return fail('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid JSON', 400); }
  const { topic } = body;
  if (!topic || !String(topic).trim()) return fail('Topic is required', 400);

  const API_KEY = env.AI_API_KEY;
  if (!API_KEY) {
    return json({ ok: false, fallback: true, error: 'AI_API_KEY not configured' }, 200);
  }
  const BASE = env.AI_BASE_URL || 'https://api.openai.com/v1';
  const PRIMARY = env.AI_MODEL || 'gpt-4o-mini';
  // Free-model fallback chain: if the primary (or any) is rate-limited/unavailable,
  // automatically try the next one. Only falls back to the built-in template if all fail.
  const FALLBACK_MODELS = [
    'minimax/minimax-m3:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'z-ai/glm-5.2:free',
    'google/gemma-4-26b-a4b-it:free',
  ];
  const MODELS = Array.from(new Set([PRIMARY, ...FALLBACK_MODELS]));
  const messages = buildPrompt(body);

  let lastErr = '';
  for (const model of MODELS) {
    try {
      const upstream = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({ model, messages, temperature: 0.7 }),
      });
      if (!upstream.ok) {
        const txt = await upstream.text();
        lastErr = `LLM ${model} error: ${upstream.status} ${txt.slice(0, 160)}`;
        continue; // rate-limited / unavailable -> try next model
      }
      const data = await upstream.json();
      let raw = data?.choices?.[0]?.message?.content || '';
      raw = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const art = JSON.parse(raw);

      const contentHtml = art.content || '<p>' + stripHtml(art.excerpt || '') + '</p>';
      const wordCount = stripHtml(contentHtml).split(/\s+/).filter(Boolean).length;
      const title = stripHtml(art.title || topic);
      const slug = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 60);

      const article = {
        title,
        slug,
        excerpt: stripHtml(art.excerpt || '').slice(0, 280),
        content: contentHtml,
        category: body.category || art.category || 'Industry News',
        author: brand_(body),
        metaTitle: stripHtml(art.metaTitle || title).slice(0, 60),
        metaDesc: stripHtml(art.metaDesc || '').slice(0, 160),
        metaKeywords: art.metaKeywords || body.keywords || '',
        wordCount,
        seoScore: computeSeo(art),
        status: 'draft',
        model,
      };
      return json({ ok: true, fallback: false, model, article }, 200);
    } catch (e) {
      lastErr = `Gen failed on ${model}: ${e.message}`;
      continue;
    }
  }
  return json({ ok: false, fallback: true, error: 'All models rate-limited', detail: lastErr }, 200);
}

function brand_(body) { return body.brand || 'NexAmuse Global'; }
