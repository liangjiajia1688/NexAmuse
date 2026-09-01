// Shared DB / response helpers for Pages Functions.
// Located in functions/_lib (underscore prefix => not a route).

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    }
  });
}

export function fail(msg, status = 400) {
  return json({ error: msg }, status);
}

export function getBearer(request) {
  const h = request.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function now() {
  return Date.now();
}

// Resolve the company a user owns (membership linkage is companies.owner_id).
// Ordered by id DESC so the most recently created company wins when a user
// happens to own more than one (keeps the panel deterministic).
export async function getMyCompany(env, userId) {
  return env.DB.prepare('SELECT * FROM companies WHERE owner_id=? ORDER BY id DESC').bind(userId).first();
}

// Convert a D1 row (object) — no transformation needed, kept for symmetry.
export function parseRow(row) {
  return row;
}
