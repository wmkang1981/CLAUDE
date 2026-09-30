import { detectStore } from './db';

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function metaContent(html: string, names: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (!key || !names.includes(key)) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return decodeEntities(content.trim());
  }
  return null;
}

export function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

// 파트너스 링크를 열어 보고 대표 이미지(og:image)와 상품명을 찾아요.
// 쇼핑몰이 로봇 접속을 막으면 실패할 수 있어요 → 그때는 사진을 직접 올리면 돼요.
export async function fetchMeta(link: string) {
  const res = await fetch(link, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', Accept: 'text/html,*/*' },
  });
  const finalUrl = res.url || link;
  const store = detectStore(finalUrl) !== 'other' ? detectStore(finalUrl) : detectStore(link);
  if (!res.ok) {
    return { ok: false as const, status: res.status, store, finalUrl };
  }
  const html = (await res.text()).slice(0, 1_500_000);
  let image = metaContent(html, ['og:image', 'og:image:url', 'twitter:image', 'image']);
  if (image) image = new URL(image, finalUrl).toString();
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ??
    decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? '');
  return { ok: true as const, status: res.status, store, finalUrl, image, title };
}
