import type { Crop } from './types';

/**
 * 관리자가 맞춘 확대/위치(crop) 그대로 사진을 보여줘요.
 * 부모 칸(비율 3:4)을 꽉 채우고, 칸 밖으로 나간 부분은 잘려요.
 */
export function CroppedImage({ src, crop, alt }: { src: string; crop: Crop | null; alt: string }) {
  if (!crop) return <img className="ci ci-cover" src={src} alt={alt} loading="lazy" decoding="async" draggable={false} />;
  const style = {
    width: `${10000 / crop.width}%`,
    height: `${10000 / crop.height}%`,
    left: `${(-crop.x * 100) / crop.width}%`,
    top: `${(-crop.y * 100) / crop.height}%`,
  };
  return <img className="ci" style={style} src={src} alt={alt} loading="lazy" decoding="async" draggable={false} />;
}
