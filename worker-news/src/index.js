/**
 * NexAmuse News Sync Worker
 * Triggers /api/news-refresh on the Pages Functions site every day via cron.
 * Kept minimal: it only pokes the endpoint — all parsing/storage lives on Pages.
 */
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sync(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/__health') return new Response('ok');
    if (url.pathname === '/sync') {
      await sync(env);
      return new Response('ok');
    }
    return new Response('not found', { status: 404 });
  }
};

async function sync(env) {
  const key = env.NEWS_KEY || 'nx2026_news_cron_7f3a9c2e5b81d4f6a0c3e9b7d1f5a8c4';
  const target = env.NEWS_URL || 'https://nexamuse.cc.cd/api/news-refresh';
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'x-cron-secret': key,
        'User-Agent': 'NexAmuseNewsCron/1.0 (+https://nexamuse.cc.cd)'
      }
    });
    const text = await res.text();
    console.log('[news-sync] status=' + res.status + ' body=' + text.slice(0, 500));
  } catch (e) {
    console.log('[news-sync] error=' + (e && e.message ? e.message : e));
  }
}
