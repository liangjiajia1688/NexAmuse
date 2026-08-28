// Lightweight HTML sanitizer for user-generated content in Workers.
const ALLOWED_TAGS = new Set([
  'p','br','b','strong','i','em','u','s','strike','del',
  'h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote',
  'a','img','span','div'
]);

export function sanitizeHtml(html) {
  if (!html) return '';
  let h = String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  return h.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, slash, tag) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';

    const lowerMatch = match.toLowerCase();
    const startIdx = lowerMatch.indexOf(t) + t.length;
    const attrPart = match.slice(startIdx, -1).trim();
    const attrs = {};

    attrPart.replace(/([a-zA-Z0-9-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/g, (m, k, v1, v2, v3) => {
      const key = k.toLowerCase();
      const val = v1 !== undefined ? v1 : (v2 !== undefined ? v2 : (v3 !== undefined ? v3 : ''));
      if (key === 'style') {
        attrs.style = val;
      } else if (t === 'a' && key === 'href' && /^(https?:|mailto:|\/|#)/i.test(val)) {
        attrs.href = val;
      } else if (t === 'a' && (key === 'target' || key === 'rel')) {
        attrs[key] = val;
      } else if (t === 'img' && key === 'src' && /^(https?:|data:image\/)/i.test(val)) {
        attrs.src = val;
      } else if (t === 'img' && (key === 'alt' || key === 'title')) {
        attrs[key] = val;
      }
      return '';
    });

    if (t === 'a') { attrs.target = '_blank'; attrs.rel = 'noopener noreferrer'; }
    if (t === 'img' && !attrs.style) attrs.style = 'max-width:100%;border-radius:8px;display:block;margin:8px 0;';

    const attrPairs = Object.entries(attrs).map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ');
    return `<${slash}${t}${attrPairs ? ' ' + attrPairs : ''}>`;
  });
}
