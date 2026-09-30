export type Crop = { x: number; y: number; width: number; height: number }; // 원본 사진 기준 퍼센트(%)
export type Store = 'coupang' | 'naver' | 'other';

export type Product = {
  id: string;
  num: number | null;
  title: string;
  category: string;
  link: string;
  store: Store;
  image_id: string | null;
  crop: Crop | null;
  hidden: boolean;
  soldout: boolean;
  sort: number;
  clicks?: number;
  /** 관리자 화면에서 아직 저장 안 한 사진 미리보기 주소 */
  localImage?: string;
};

export type Settings = {
  title: string;
  subtitle: string;
  disclosure: string;
  columns: string; // '2' | '3'
  showTitle: string; // '1' | '0'
};

/** 사진 칸 비율: 가로 3 : 세로 4 (인스타 프로필 격자와 같은 비율) */
export const TILE_ASPECT = 3 / 4;

export const STORE_LABEL: Record<Store, string> = { coupang: '쿠팡', naver: '네이버', other: '구매' };

export function detectStore(link: string): Store {
  let host = '';
  try {
    host = new URL(link).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (host === 'coupa.ng' || host.endsWith('coupang.com')) return 'coupang';
  if (host === 'naver.me' || host.endsWith('naver.com') || host.endsWith('naver.net')) return 'naver';
  return 'other';
}

export function imageSrc(p: Pick<Product, 'image_id' | 'localImage'>): string | null {
  return p.localImage ?? (p.image_id ? `/img/${p.image_id}` : null);
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** 번호 또는 상품명으로 찾기 */
export function matchesQuery(p: Product, query: string): boolean {
  const q = query.trim().replace(/^#|번$/g, '');
  if (!q) return true;
  if (/^\d+$/.test(q) && p.num !== null && String(p.num) === q) return true;
  return norm(p.title).includes(norm(q)) || norm(p.category).includes(norm(q));
}
