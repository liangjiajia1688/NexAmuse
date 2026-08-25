// 鉴权模块：密码哈希 + Token 签发/校验
// 依赖 Web Crypto API（Cloudflare Workers / Pages Functions 原生支持）

const enc = new TextEncoder();
const ITERATIONS = 100000;

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// 哈希密码，返回 { hash, salt }（均为 hex 字符串）
export async function hashPassword(password, saltHex) {
  const salt = saltHex
    ? hexToBuf(saltHex)
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return { hash: bufToHex(bits), salt: bufToHex(salt) };
}

// 校验密码
export async function verifyPassword(password, saltHex, expectedHash) {
  const { hash } = await hashPassword(password, saltHex);
  return hash === expectedHash;
}

// 签发 Token：payload 为 { uid }，7 天有效
export async function signToken(payload, secret) {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 7 * 86400000 });
  const b64 = btoaUnicode(data);
  const sig = await hmac(b64, secret);
  return `${b64}.${sig}`;
}

// 校验 Token，失败返回 null
export async function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [b64, sig] = token.split('.');
  const expected = await hmac(b64, secret);
  if (sig !== expected) return null;
  let payload;
  try { payload = JSON.parse(atobUnicode(b64)); } catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bufToHex(sig);
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// btoa/atob 对中文不友好，用 TextEncoder/TextDecoder 处理 UTF-8
function btoaUnicode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function atobUnicode(str) {
  const bin = atob(str);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
