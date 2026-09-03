import { runAggregation } from './_lib/aggregate.js';

// Cron Trigger entry (configure in Cloudflare Dashboard → Pages → Settings → Functions → Cron Triggers).
// Cron expression:  0 1 * * *   (UTC 01:00 = Beijing 09:00)
export async function scheduled(event, env, ctx) {
  const result = await runAggregation(env);
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' }
  });
}
