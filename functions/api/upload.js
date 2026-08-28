import { json, fail } from '../_lib/db.js';
import { authUser } from '../_lib/auth.js';
import { requireLevel } from '../_lib/permissions.js';
import { uploadToImgBB } from '../_lib/imgbb.js';

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  const user = await authUser(request, env);
  if (!user) return fail('Unauthorized', 401);
  const perm = requireLevel(user, 'Premium', 'Upload images');
  if (!perm.ok) return fail(perm.message, perm.code);

  let form;
  try { form = await request.formData(); } catch (e) { return fail('Invalid form data'); }
  const image = form.get('image');
  if (!image) return fail('No image provided');

  let b64;
  if (typeof image === 'string') {
    // Strip data URL prefix if present; ImgBB expects raw base64.
    const m = image.match(/^data:image\/[^;]+;base64,(.*)$/);
    b64 = m ? m[1] : image;
  } else if (image && typeof image.arrayBuffer === 'function') {
    b64 = toBase64(await image.arrayBuffer());
  } else {
    return fail('No image provided');
  }

  try {
    const url = await uploadToImgBB(b64, env.IMGBB_API_KEY);
    return json({ url });
  } catch (e) {
    return fail(e.message || 'Upload failed', 500);
  }
}
