import { json, fail } from '../../_lib/db.js';
import { runAggregation } from '../../_lib/aggregate.js';

// GET /api/cron/aggregate-videos?key=CRON_KEY
// Manual / external trigger for the daily YouTube video aggregation.
// Protected by the same CRON_KEY used elsewhere in the project.
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || key !== env.CRON_KEY) return fail('Forbidden', 403);

  const result = await runAggregation(env);
  return json(result);
}
