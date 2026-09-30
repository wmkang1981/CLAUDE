import type { Category, Product, Settings } from '../shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  let r: Response;
  try {
    r = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError('인터넷 연결을 확인해 주세요.', 0);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError((data as { error?: string }).error ?? `문제가 생겼어요 (${r.status})`, r.status);
  return data as T;
}

export type ProductPayload = Pick<
  Product,
  'num' | 'title' | 'category' | 'link' | 'image_id' | 'crop' | 'hidden' | 'soldout'
>;

export const adminApi = {
  me: () => api<{ loggedIn: boolean; passwordSet: boolean }>('/api/admin/me'),
  login: (password: string) => api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => api('/api/admin/logout', { method: 'POST' }),
  site: () => api<{ settings: Settings; categories: Category[] }>('/api/site'),
  products: () => api<{ products: Product[] }>('/api/admin/products'),
  create: (p: ProductPayload) =>
    api<{ product: Product }>('/api/admin/products', { method: 'POST', body: JSON.stringify(p) }),
  update: (id: string, p: ProductPayload) =>
    api<{ product: Product }>(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  remove: (id: string) => api(`/api/admin/products/${id}`, { method: 'DELETE' }),
  reorder: (ids: string[]) => api('/api/admin/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  saveSettings: (s: Settings) =>
    api<{ settings: Settings }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(s) }),
  saveCategories: (categories: Category[]) =>
    api<{ categories: Category[] }>('/api/admin/categories', { method: 'PUT', body: JSON.stringify({ categories }) }),
  uploadImage: (blob: Blob) =>
    api<{ id: string }>('/api/admin/images', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } }),
  fetchMeta: (url: string) =>
    api<{ ok: boolean; status: number; store: string; finalUrl: string; image?: string | null; title?: string }>(
      '/api/admin/fetch-meta',
      { method: 'POST', body: JSON.stringify({ url }) },
    ),
  async proxyImage(url: string): Promise<Blob> {
    const r = await fetch(`/api/admin/proxy-image?url=${encodeURIComponent(url)}`, { credentials: 'same-origin' });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new ApiError((d as { error?: string }).error ?? '사진을 받아오지 못했어요.', r.status);
    }
    return r.blob();
  },
};
