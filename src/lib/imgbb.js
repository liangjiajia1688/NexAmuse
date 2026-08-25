// ImgBB 图片上传封装
// 文档：https://api.imgbb.com/
// 免费 API：把图片（base64 或远程 URL）POST 到 /1/upload，返回直接图片链接

const ENDPOINT = 'https://api.imgbb.com/1/upload';

// imageInput: dataURL（如 "data:image/png;base64,xxxx"）或 远程图片 URL
// 返回直接可用的图片 URL 字符串
export async function uploadToImgBB(imageInput, apiKey) {
  if (!apiKey) throw new Error('缺少 IMGBB_API_KEY 环境变量');
  const form = new FormData();
  form.append('key', apiKey);
  if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
    form.append('image', imageInput.split(',')[1]); // 取 base64 部分
  } else {
    form.append('image', imageInput);
  }

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'ImgBB 上传失败');
  }
  return json.data.url; // 直接图片链接
}
