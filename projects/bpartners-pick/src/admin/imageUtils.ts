const MAX_SIDE = 1200; // 휴대폰 화면에는 이 정도면 충분히 선명해요
const TARGET_BYTES = 1_500_000;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** 올리기 전에 사진 크기를 줄이고 가벼운 형식(webp)으로 바꿔요 */
export async function prepareImage(input: Blob): Promise<Blob> {
  if (!input.type.startsWith('image/')) throw new Error('사진 파일이 아니에요.');
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(input);
  } catch {
    throw new Error('이 사진은 열 수 없어요. JPG나 PNG로 다시 시도해 주세요.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();

  let last: Blob | null = null;
  for (const q of [0.86, 0.75, 0.6, 0.45]) {
    let out = await toBlob(canvas, 'image/webp', q);
    if (!out || out.type !== 'image/webp') out = await toBlob(canvas, 'image/jpeg', q);
    if (!out) continue;
    last = out;
    if (out.size <= TARGET_BYTES) return out;
  }
  if (!last) throw new Error('사진을 처리하지 못했어요.');
  return last;
}

/** 다른 브라우저 탭에서 사진을 끌어다 놓았을 때 사진 주소를 찾아요 */
export function imageUrlFromDrop(dt: DataTransfer): string | null {
  const html = dt.getData('text/html');
  const fromHtml = html && html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const uri = dt.getData('text/uri-list').split('\n').find((l) => l && !l.startsWith('#'));
  const url = (fromHtml || uri || dt.getData('text/plain') || '').trim();
  return /^https?:\/\//i.test(url) ? url.replace(/&amp;/g, '&') : null;
}
