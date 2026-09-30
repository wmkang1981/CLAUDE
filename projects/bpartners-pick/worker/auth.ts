import type { Env } from './db';

const COOKIE = 'bp_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30일
const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sameText(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(da, db);
}

export async function checkPassword(env: Env, password: string): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  return sameText(password, env.ADMIN_PASSWORD);
}

// 비밀번호를 바꾸면 기존 로그인은 모두 풀려요 (서명 키가 비밀번호라서)
export async function makeSessionCookie(env: Env, secure: boolean): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const sig = await hmac(env.ADMIN_PASSWORD!, `bp:${exp}`);
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function isLoggedIn(req: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const cookie = req.headers.get('Cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([A-Za-z0-9_-]+)`));
  if (!m) return false;
  const exp = Number(m[1]);
  if (exp < Date.now() / 1000) return false;
  return sameText(m[2], await hmac(env.ADMIN_PASSWORD, `bp:${exp}`));
}
