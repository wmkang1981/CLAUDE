import { DEFAULT_SETTINGS, type Env, type ProductRow, detectStore, ensureSchema, readCategories, readSettings, toProduct } from './db';
import { checkPassword, clearSessionCookie, isLoggedIn, makeSessionCookie } from './auth';
import { fetchMeta, isHttpUrl } from './meta';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}
const fail = (message: string, status = 400) => json({ error: message }, status);

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, '요청 형식이 올바르지 않아요.');
  }
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type ProductInput = {
  num?: number | null;
  title?: string;
  category?: string;
  link?: string;
  image_id?: string | null;
  crop?: { x: number; y: number; width: number; height: number } | null;
  hidden?: boolean;
  soldout?: boolean;
};

function cleanProduct(p: ProductInput) {
  const link = (p.link ?? '').trim();
  if (link && !isHttpUrl(link)) throw new HttpError(400, '구매 링크는 http:// 또는 https:// 로 시작해야 해요.');
  const num = p.num === null || p.num === undefined || (p.num as unknown) === '' ? null : Math.trunc(Number(p.num));
  if (num !== null && !Number.isFinite(num)) throw new HttpError(400, '번호는 숫자로 적어주세요.');
  let crop: string | null = null;
  if (p.crop) {
    const { x, y, width, height } = p.crop;
    if (![x, y, width, height].every((v) => typeof v === 'number' && Number.isFinite(v)) || width <= 0 || height <= 0)
      throw new HttpError(400, '사진 위치 정보가 올바르지 않아요.');
    crop = JSON.stringify({ x, y, width, height });
  }
  return {
    num,
    title: (p.title ?? '').trim().slice(0, 200),
    category: (p.category ?? '').trim().slice(0, 64),
    link,
    store: detectStore(link),
    image_id: p.image_id ?? null,
    crop,
    hidden: p.hidden ? 1 : 0,
    soldout: p.soldout ? 1 : 0,
  };
}

async function deleteImage(env: Env, id: string | null | undefined) {
  if (id) await env.IMAGES.delete(id);
}

async function handleAdmin(req: Request, env: Env, path: string): Promise<Response> {
  const method = req.method;

  if (path === '/api/admin/login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD)
      return fail('관리자 비밀번호(ADMIN_PASSWORD)가 아직 설정되지 않았어요. 설명서의 "비밀번호 정하기"를 먼저 해주세요.', 503);
    const { password } = await body<{ password?: string }>(req);
    if (!(await checkPassword(env, password ?? ''))) {
      await new Promise((r) => setTimeout(r, 800)); // 비밀번호 마구 넣어보기 늦추기
      return fail('비밀번호가 맞지 않아요.', 401);
    }
    const secure = new URL(req.url).protocol === 'https:';
    return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(env, secure) });
  }
  if (path === '/api/admin/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }
  if (path === '/api/admin/me') {
    return json({ loggedIn: await isLoggedIn(req, env), passwordSet: !!env.ADMIN_PASSWORD });
  }

  if (!(await isLoggedIn(req, env))) return fail('로그인이 필요해요.', 401);

  // 상품 목록 (숨긴 상품, 클릭 수 포함)
  if (path === '/api/admin/products' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY sort ASC, created_at DESC').all<ProductRow>();
    return json({ products: results.map((r) => toProduct(r, true)) });
  }

  // 새 상품 (맨 앞에 추가)
  if (path === '/api/admin/products' && method === 'POST') {
    const p = cleanProduct(await body<ProductInput>(req));
    const id = crypto.randomUUID();
    const now = Date.now();
    const top = await env.DB.prepare('SELECT MIN(sort) AS m FROM products').first<{ m: number | null }>();
    const sort = (top?.m ?? 1) - 1;
    await env.DB.prepare(
      `INSERT INTO products (id, num, title, category, link, store, image_id, crop, hidden, soldout, sort, clicks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
      .bind(id, p.num, p.title, p.category, p.link, p.store, p.image_id, p.crop, p.hidden, p.soldout, sort, now, now)
      .run();
    const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>();
    return json({ product: toProduct(row!, true) });
  }

  const m = path.match(/^\/api\/admin\/products\/([\w-]+)$/);
  if (m) {
    const id = m[1];
    const old = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>();
    if (!old) return fail('상품을 찾을 수 없어요.', 404);
    if (method === 'PUT') {
      const p = cleanProduct(await body<ProductInput>(req));
      await env.DB.prepare(
        `UPDATE products SET num=?, title=?, category=?, link=?, store=?, image_id=?, crop=?, hidden=?, soldout=?, updated_at=? WHERE id=?`,
      )
        .bind(p.num, p.title, p.category, p.link, p.store, p.image_id, p.crop, p.hidden, p.soldout, Date.now(), id)
        .run();
      if (old.image_id && old.image_id !== p.image_id) await deleteImage(env, old.image_id);
      const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>();
      return json({ product: toProduct(row!, true) });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      await deleteImage(env, old.image_id);
      return json({ ok: true });
    }
  }

  // 순서 바꾸기: 화면에 보이는 순서대로 id 목록을 받아요
  if (path === '/api/admin/reorder' && method === 'POST') {
    const { ids } = await body<{ ids?: string[] }>(req);
    if (!Array.isArray(ids)) return fail('순서 정보가 없어요.');
    const stmt = env.DB.prepare('UPDATE products SET sort = ? WHERE id = ?');
    if (ids.length) await env.DB.batch(ids.map((id, i) => stmt.bind(i, String(id))));
    return json({ ok: true });
  }

  if (path === '/api/admin/settings' && method === 'PUT') {
    const input = await body<Record<string, unknown>>(req);
    const stmts: D1PreparedStatement[] = [];
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (input[key] === undefined) continue;
      stmts.push(
        env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(
          key,
          String(input[key]).slice(0, 500),
        ),
      );
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ settings: await readSettings(env.DB) });
  }

  // 카테고리 목록 통째로 저장 (보이는 순서 그대로)
  if (path === '/api/admin/categories' && method === 'PUT') {
    const { categories } = await body<{ categories?: { id?: string; name?: string; color?: string }[] }>(req);
    if (!Array.isArray(categories) || categories.length > 50) return fail('카테고리 정보가 올바르지 않아요.');
    const clean = categories.map((c) => {
      const name = String(c.name ?? '').trim().slice(0, 12);
      if (!name) throw new HttpError(400, '카테고리 이름을 적어주세요.');
      const color = /^#[0-9a-f]{6}$/i.test(c.color ?? '') ? c.color!.toLowerCase() : '#ffe66d';
      const id = typeof c.id === 'string' && /^[\w-]{1,64}$/.test(c.id) ? c.id : crypto.randomUUID();
      return { id, name, color };
    });
    const ids = JSON.stringify(clean.map((c) => c.id));
    const upsert = env.DB.prepare(
      'INSERT INTO categories (id, name, color, sort) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, sort = excluded.sort',
    );
    await env.DB.batch([
      env.DB.prepare('DELETE FROM categories WHERE id NOT IN (SELECT value FROM json_each(?))').bind(ids),
      // 지운 카테고리에 있던 상품은 "전체"에서만 보이게 돼요
      env.DB.prepare("UPDATE products SET category = '' WHERE category <> '' AND category NOT IN (SELECT value FROM json_each(?))").bind(ids),
      ...clean.map((c, i) => upsert.bind(c.id, c.name, c.color, i)),
    ]);
    return json({ categories: await readCategories(env.DB) });
  }

  // 사진 올리기 (브라우저에서 미리 줄인 사진을 받아요)
  if (path === '/api/admin/images' && method === 'POST') {
    const type = req.headers.get('Content-Type') ?? '';
    if (!/^image\/(webp|jpeg|png|gif|avif)$/.test(type)) return fail('사진 파일만 올릴 수 있어요.');
    const data = await req.arrayBuffer();
    if (data.byteLength === 0) return fail('빈 파일이에요.');
    if (data.byteLength > MAX_IMAGE_BYTES) return fail('사진이 너무 커요 (5MB 이하).');
    const id = crypto.randomUUID();
    await env.IMAGES.put(id, data, { metadata: { type } });
    return json({ id });
  }

  // 링크에서 상품명·대표 사진 찾기
  if (path === '/api/admin/fetch-meta' && method === 'POST') {
    const { url } = await body<{ url?: string }>(req);
    if (!url || !isHttpUrl(url)) return fail('올바른 링크를 넣어주세요.');
    try {
      return json(await fetchMeta(url));
    } catch {
      return json({ ok: false, status: 0, store: detectStore(url), finalUrl: url });
    }
  }

  // 다른 사이트 사진을 대신 받아오기 (브라우저는 보안 때문에 직접 못 받아요)
  if (path === '/api/admin/proxy-image' && method === 'GET') {
    const target = new URL(req.url).searchParams.get('url') ?? '';
    if (!isHttpUrl(target)) return fail('올바른 사진 주소가 아니에요.');
    const r = await fetch(target, { headers: { Accept: 'image/*' }, redirect: 'follow' });
    const type = r.headers.get('Content-Type') ?? '';
    if (!r.ok || !type.startsWith('image/')) return fail(`사진을 받아오지 못했어요 (${r.status}).`, 502);
    const data = await r.arrayBuffer();
    if (data.byteLength > 15 * 1024 * 1024) return fail('사진이 너무 커요.', 413);
    return new Response(data, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
  }

  return fail('없는 주소예요.', 404);
}

async function route(req: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const path = url.pathname;

  // 손님 화면용: 사이트 설정 + 보이는 상품
  if (path === '/api/site' && req.method === 'GET') {
    const [settings, categories, { results }] = await Promise.all([
      readSettings(env.DB),
      readCategories(env.DB),
      env.DB.prepare('SELECT * FROM products WHERE hidden = 0 ORDER BY sort ASC, created_at DESC').all<ProductRow>(),
    ]);
    return json({ settings, categories, products: results.map((r) => toProduct(r, false)) });
  }

  // 사진 클릭 수 세기
  const click = path.match(/^\/api\/click\/([\w-]+)$/);
  if (click && req.method === 'POST') {
    ctx.waitUntil(env.DB.prepare('UPDATE products SET clicks = clicks + 1 WHERE id = ?').bind(click[1]).run());
    return new Response(null, { status: 204 });
  }

  // 사진 보여주기 (한 번 올린 사진은 바뀌지 않으니 오래 저장해도 돼요)
  const img = path.match(/^\/img\/([\w-]+)$/);
  if (img && req.method === 'GET') {
    const { value, metadata } = await env.IMAGES.getWithMetadata<{ type?: string }>(img[1], {
      type: 'arrayBuffer',
      cacheTtl: 86400,
    });
    if (!value) return new Response('Not found', { status: 404 });
    return new Response(value, {
      headers: {
        'Content-Type': metadata?.type ?? 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  if (path.startsWith('/api/admin/')) return handleAdmin(req, env, path);
  return fail('없는 주소예요.', 404);
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/img/')) return env.ASSETS.fetch(req);
    try {
      await ensureSchema(env.DB);
      return await route(req, env, ctx, url);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      console.error(e);
      return fail('서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.', 500);
    }
  },
} satisfies ExportedHandler<Env>;
