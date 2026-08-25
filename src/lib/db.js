// 共享工具函数

export const now = () => Math.floor(Date.now() / 1000);

// 安全 JSON 解析，失败返回 fallback
export function parseJSON(str, fallback = null) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// 把产物对象里可能为 JSON 字符串的字段解析好
export function parseRow(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.images && typeof out.images === 'string') {
    out.images = parseJSON(out.images, []);
  }
  return out;
}

// 从请求 Authorization 头提取 token
export function getBearer(request) {
  const h = request.headers.get('Authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

// 统一 JSON 响应
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// 统一错误响应
export function fail(message, status = 400) {
  return json({ ok: false, error: message }, status);
}
