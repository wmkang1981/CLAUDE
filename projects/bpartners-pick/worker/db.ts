export interface Env {
  DB: D1Database;
  IMAGES: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
}

export const DEFAULT_SETTINGS = {
  title: 'B.Partners Pick',
  subtitle: '릴스에서 본 그 상품, 번호로 찾아보세요',
  disclosure:
    '이 페이지는 쿠팡 파트너스 및 네이버 쇼핑 커넥트 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
  columns: '2',
  showTitle: '1',
};
export type SettingsRow = typeof DEFAULT_SETTINGS;

let schemaReady: Promise<void> | null = null;

// 테이블이 없으면 처음 한 번 만들어요 (관리자가 따로 DB 작업을 안 해도 되게)
export function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          num INTEGER,
          title TEXT NOT NULL DEFAULT '',
          price TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          link TEXT NOT NULL DEFAULT '',
          store TEXT NOT NULL DEFAULT 'other',
          image_id TEXT,
          crop TEXT,
          hidden INTEGER NOT NULL DEFAULT 0,
          soldout INTEGER NOT NULL DEFAULT 0,
          sort INTEGER NOT NULL DEFAULT 0,
          clicks INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
        // 왼쪽 포스트잇 카테고리 (상품의 category 칸에는 이 id가 들어가요)
        db.prepare(`CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#ffe66d',
          sort INTEGER NOT NULL DEFAULT 0
        )`),
      ])
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}

export async function readSettings(db: D1Database): Promise<SettingsRow> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results) if (r.key in s) (s as Record<string, string>)[r.key] = r.value;
  return s;
}

export type Category = { id: string; name: string; color: string };

export async function readCategories(db: D1Database): Promise<Category[]> {
  const { results } = await db.prepare('SELECT id, name, color FROM categories ORDER BY sort ASC').all<Category>();
  return results;
}

export type ProductRow = {
  id: string;
  num: number | null;
  title: string;
  category: string;
  link: string;
  store: string;
  image_id: string | null;
  crop: string | null;
  hidden: number;
  soldout: number;
  sort: number;
  clicks: number;
};

export function toProduct(r: ProductRow, withStats: boolean) {
  return {
    id: r.id,
    num: r.num,
    title: r.title,
    category: r.category,
    link: r.link,
    store: r.store,
    image_id: r.image_id,
    crop: r.crop ? JSON.parse(r.crop) : null,
    hidden: !!r.hidden,
    soldout: !!r.soldout,
    sort: r.sort,
    ...(withStats ? { clicks: r.clicks } : {}),
  };
}

export function detectStore(link: string): 'coupang' | 'naver' | 'other' {
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
