// PBKDF2 password hashing + HMAC token auth using Web Crypto (Works in Workers).
import { getBearer } from './db.js';

const enc = new TextEncoder();

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
    return hex === hashHex;
  } catch (e) {
    return false;
  }
}

async function signToken(payload, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeToken(userId, secret) {
  const payload = `${userId}.${Date.now()}`;
  const sig = await signToken(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  const sig = parts.pop();
  const payload = parts.join('.');
  const expect = await signToken(payload, secret);
  if (sig !== expect) return null;
  const uid = parseInt(payload.split('.')[0], 10);
  return Number.isFinite(uid) ? uid : null;
}

export async function authUser(request, env) {
  const token = getBearer(request);
  if (!token) return null;
  const uid = await verifyToken(token, env.TOKEN_SECRET);
  if (!uid) return null;
  const row = await env.DB.prepare('SELECT id,email,username,role,avatar FROM users WHERE id=?').bind(uid).first();
  return row || null;
}
