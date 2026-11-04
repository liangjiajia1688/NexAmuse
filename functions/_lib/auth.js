// PBKDF2 password hashing + HMAC token auth using Web Crypto (Works in Workers).
import { getBearer } from './db.js';

const enc = new TextEncoder();

// Session lifetime. Tokens older than this are rejected, so a stolen
// token cannot be replayed forever.
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_COOKIE = 'nx_session';

// Constant-time string comparison — prevents timing side-channels when
// comparing HMAC signatures / password hashes.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const hex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${saltHex}$${hex}`;
}

export async function verifyPassword(pw, stored) {
  try {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const saltHex = parts[1];
    const hashHex = parts[2];
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
    const hex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return safeEqual(hex, hashHex);
  } catch (e) {
    return false;
  }
}

async function signToken(payload, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeToken(userId, secret, version = 0) {
  const issued = Date.now();
  const payload = `${userId}.${issued}.${version | 0}`;
  const sig = await signToken(payload, secret);
  return `${payload}.${sig}`;
}

// Returns { uid, version } for a valid token, or null when the token is
// missing / forged / expired. The version is compared against the user's
// token_version so logout can revoke sessions server-side.
export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [rawId, rawIssued, rawVersion, sig] = parts;
  const payload = `${rawId}.${rawIssued}.${rawVersion}`;
  const expect = await signToken(payload, secret);
  if (!safeEqual(sig, expect)) return null;

  const uid = parseInt(rawId, 10);
  const issued = parseInt(rawIssued, 10);
  const version = parseInt(rawVersion, 10);
  if (!Number.isFinite(uid) || !Number.isFinite(issued) || !Number.isFinite(version)) return null;
  const age = Date.now() - issued;
  if (age < 0 || age > TOKEN_TTL_MS) return null; // expired / future-dated
  return { uid, version };
}

// ── Cookie helpers ───────────────────────────────────────────────
export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return part.slice(i + 1).trim(); }
    }
  }
  return null;
}

// Session token can arrive either as the HttpOnly session cookie (set by
// /api/login) or as an Authorization bearer header (legacy clients).
export function tokenFromRequest(request) {
  return getCookie(request, SESSION_COOKIE) || getBearer(request);
}

export function sessionCookie(token, url) {
  const secure = url && url.protocol === 'https:' ? '; Secure' : '';
  const maxAge = Math.floor(TOKEN_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(url) {
  const secure = url && url.protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}

export async function authUser(request, env) {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const claim = await verifyToken(token, env.TOKEN_SECRET);
  if (!claim) return null;
  const row = await env.DB.prepare(
    'SELECT id,email,username,role,avatar,level,points,status,is_super,token_version FROM users WHERE id=?'
  ).bind(claim.uid).first();
  if (!row) return null;
  // Session revocation: a bumped token_version invalidates every prior token.
  if ((row.token_version || 0) !== claim.version) return null;
  // Suspended / disabled accounts lose access immediately, even with a valid token.
  if (row.status && ['banned', 'suspended', 'disabled', 'inactive'].includes(String(row.status).toLowerCase())) return null;
  return row;
}

export async function authAdmin(request, env) {
  const user = await authUser(request, env);
  if (!user) return null;
  return (user.role === 'admin' || user.is_super === 1) ? user : null;
}
