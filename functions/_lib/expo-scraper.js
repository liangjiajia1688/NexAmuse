// Best-effort exhibition date scraper.
// Fetches an official event website and tries to extract the NEXT occurrence
// date using heuristic regex patterns. Not 100% reliable across arbitrary sites
// (JS-rendered dates, bot blocking, unusual formats) — callers should treat the
// returned `confidence` and keep a human-review flag when it is low.

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
  sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
};

function normMonth(s) {
  return MONTHS[(s || '').toLowerCase().replace(/\./g, '')];
}

function parseDates(text) {
  const found = [];
  const push = (y, mo, d1, d2, conf) => {
    if (mo < 0 || mo > 11 || d1 < 1 || d1 > 31 || y < 1990 || y > 2100) return;
    const end = d2 && d2 >= d1 ? d2 : d1;
    found.push({
      start: Date.UTC(y, mo, d1),
      end: Date.UTC(y, mo, end),
      year: y,
      conf
    });
  };

  // A) Month DD[-DD], YYYY  /  Month DD, YYYY
  let re = /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*(?:-|–|—|to)\s*(\d{1,2}))?,?\s*,?\s*(\d{4})/gi;
  let m;
  while ((m = re.exec(text))) push(+m[4], normMonth(m[1]), +m[2], m[3] ? +m[3] : null, m[3] ? 2 : 1);

  // B) DD[-DD] Month YYYY
  re = /(\d{1,2})(?:\s*(?:-|–|—|to)\s*(\d{1,2}))?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{4})/gi;
  while ((m = re.exec(text))) push(+m[3], normMonth(m[2]), +m[1], m[2] ? +m[2] : null, m[2] ? 2 : 1);

  // C) YYYY-MM-DD / YYYY/MM/DD
  re = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/g;
  while ((m = re.exec(text))) push(+m[1], +m[2] - 1, +m[3], null, 2);

  // D) Chinese: YYYY年MM月DD日
  re = /(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日?)?/g;
  while ((m = re.exec(text))) push(+m[1], +m[2] - 1, m[3] ? +m[3] : 1, null, 1);

  return found;
}

export async function scrapeShowDates(url, opts = {}) {
  const refYear = opts.refYear || new Date().getFullYear();
  const timeout = opts.timeout || 9000;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: ctrl.signal,
      redirect: 'follow'
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, reason: 'HTTP ' + res.status, confidence: 0 };

    const raw = await res.text();
    // Strip scripts/styles and tags to reduce false positives.
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/g, ' ');

    const dates = parseDates(text);
    if (!dates.length) return { ok: false, reason: 'no date pattern found', confidence: 0 };

    const now = Date.now();
    const future = dates.filter(d => d.end >= now || d.year >= refYear);
    const pool = future.length ? future : dates;
    pool.sort((a, b) => a.start - b.start);
    const best = pool[0];

    const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);
    return {
      ok: true,
      startDate: fmt(best.start),
      endDate: fmt(best.end),
      year: best.year,
      confidence: best.conf,
      candidates: dates.length
    };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e), confidence: 0 };
  }
}
