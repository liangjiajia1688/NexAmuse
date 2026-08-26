// ImgBB upload helper. Backend-only: API key comes from env, never the browser.

export async function uploadToImgBB(base64, apiKey) {
  const form = new FormData();
  form.append('image', base64);
  const res = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(apiKey), {
    method: 'POST',
    body: form
  });
  const j = await res.json();
  if (j && j.success && j.data && j.data.url) {
    return j.data.url;
  }
  throw new Error((j && j.error && (j.error.message || j.error)) || 'ImgBB upload failed');
}
