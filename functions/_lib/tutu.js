// tutu.to (兔兔图床) upload helper. Backend-only: API key comes from env, never the browser.
//
// API v2 (Chevereto-compatible):
//   POST https://tutu.to/api/2/upload?key=<API_KEY>
//   multipart/form-data field: source = base64 image data
//
// Response (200):
//   { "image": { "url_viewer": "https://tutu.to/image/<id>", ... }, "status_code": 200, "success": {...} }
//
// Direct link is NOT included in the response; derive it as:
//   https://t.tutu.to/img/<id>   (id = last segment of url_viewer)

export async function uploadToTutu(base64, apiKey) {
  if (!apiKey) throw new Error('TUTU_API_KEY not configured');
  const form = new FormData();
  form.append('source', base64);
  const res = await fetch('https://tutu.to/api/2/upload?key=' + encodeURIComponent(apiKey), {
    method: 'POST',
    body: form,
  });
  const j = await res.json().catch(() => ({}));
  if (j && j.status_code === 200 && j.image && j.image.url_viewer) {
    const id = String(j.image.url_viewer).split('/').pop();
    if (id) return 'https://t.tutu.to/img/' + id;
  }
  throw new Error((j && j.error && j.error.message) || 'tutu.to upload failed');
}
