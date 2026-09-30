export type Crop = { x: number; y: number; width: number; height: number }; // 원본 사진 기준 퍼센트(%)
export type Store = 'coupang' | 'naver' | 'other';

export type Product = {
  id: string;
  num: number | null;
  title: string;
  /** 카테고리 id (없으면 '') */
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

export type Category = { id: string; name: string; color: string };

/** 포스트잇 기본 색상 */
export const NOTE_COLORS = ['#ffe66d', '#ffb3c7', '#b8f2b0', '#a7d8ff', '#ffc98b', '#d7c2ff', '#a8f0e0', '#ffffff'];

/** 배경색이 어두우면 흰 글씨, 밝으면 검은 글씨 */
export function noteTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1f1f1f' : '#ffffff';
}

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
export function matchesQuery(p: Product, query: string, categoryName = ''): boolean {
  const q = query.trim().replace(/^#|번$/g, '');
  if (!q) return true;
  if (/^\d+$/.test(q) && p.num !== null && String(p.num) === q) return true;
  return norm(p.title).includes(norm(q)) || (!!categoryName && norm(categoryName).includes(norm(q)));
}
