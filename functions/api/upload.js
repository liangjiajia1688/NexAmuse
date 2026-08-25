// 图片上传：转发到 ImgBB，返回直接图片 URL
import { verifyToken } from '../../src/lib/auth.js';
import { getBearer, json, fail } from '../../src/lib/db.js';
import { uploadToImgBB } from '../../src/lib/imgbb.js';

export async function onRequestPost({ request, env }) {
  const token = getBearer(request);
  const payload = token && await verifyToken(token, env.TOKEN_SECRET);
  if (!payload) return fail('请先登录', 401);

  let body;
  try { body = await request.json(); } catch { return fail('请求格式错误'); }
  const { image } = body; // dataURL（data:image/png;base64,xxx）或远程图片 URL
  if (!image) return fail('缺少 image 字段');

  try {
    const url = await uploadToImgBB(image, env.IMGBB_API_KEY);
    return json({ ok: true, url });
  } catch (e) {
    return fail('上传失败：' + e.message, 500);
  }
}
