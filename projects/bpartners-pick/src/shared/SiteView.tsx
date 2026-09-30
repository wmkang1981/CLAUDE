import { useMemo, useState } from 'react';
import { CroppedImage } from './CroppedImage';
import { STORE_LABEL, imageSrc, matchesQuery, type Product, type Settings } from './types';

type Props = {
  settings: Settings;
  products: Product[];
  /** 관리자 미리보기: 사진을 눌러도 쇼핑몰로 가지 않고 편집을 열어요 */
  onSelect?: (p: Product) => void;
  selectedId?: string | null;
};

export function SiteView({ settings, products, onSelect, selectedId }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products],
  );
  const shown = products.filter((p) => (!category || p.category === category) && matchesQuery(p, query));
  const cols = settings.columns === '3' ? 3 : 2;
  const showTitle = settings.showTitle !== '0';

  const onClick = (e: React.MouseEvent, p: Product) => {
    if (onSelect) {
      e.preventDefault();
      onSelect(p);
      return;
    }
    if (!p.link) {
      e.preventDefault();
      return;
    }
    try {
      navigator.sendBeacon(`/api/click/${p.id}`);
    } catch {
      /* 클릭 수는 못 세도 이동은 돼요 */
    }
  };

  return (
    <div className="site">
      <header className="site-head">
        <h1 className="site-title">{settings.title}</h1>
        {settings.subtitle && <p className="site-sub">{settings.subtitle}</p>}
      </header>

      {settings.disclosure && <p className="site-disclosure">{settings.disclosure}</p>}

      <div className="site-search">
        <span aria-hidden="true">🔍</span>
        <input
          type="search"
          inputMode="search"
          placeholder="번호 또는 상품명으로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="번호 또는 상품명으로 찾기"
        />
        {query && (
          <button type="button" className="site-search-clear" onClick={() => setQuery('')} aria-label="지우기">
            ✕
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <nav className="site-cats" aria-label="카테고리">
          <button type="button" className={!category ? 'on' : ''} onClick={() => setCategory('')}>
            전체
          </button>
          {categories.map((c) => (
            <button type="button" key={c} className={category === c ? 'on' : ''} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </nav>
      )}

      {shown.length === 0 ? (
        <p className="site-empty">{products.length === 0 ? '아직 등록된 상품이 없어요.' : '찾는 상품이 없어요. 번호를 다시 확인해 주세요.'}</p>
      ) : (
        <ul className={`site-grid cols-${cols}`}>
          {shown.map((p) => {
            const src = imageSrc(p);
            return (
              <li key={p.id} className={`tile${selectedId === p.id ? ' selected' : ''}${p.hidden ? ' is-hidden' : ''}`}>
                <a
                  href={p.link || undefined}
                  target="_blank"
                  rel="noopener sponsored"
                  onClick={(e) => onClick(e, p)}
                  aria-label={`${p.num ? p.num + '번 ' : ''}${p.title || '상품'} 구매하러 가기`}
                >
                  <div className="tile-media">
                    {src ? <CroppedImage src={src} crop={p.crop} alt={p.title} /> : <div className="tile-noimg">사진 없음</div>}
                    {p.num !== null && <span className="tile-num">{p.num}</span>}
                    <span className={`tile-store store-${p.store}`}>{STORE_LABEL[p.store]}</span>
                    {p.soldout && <span className="tile-soldout">품절</span>}
                    {p.hidden && <span className="tile-hiddenmark">숨김</span>}
                  </div>
                  {showTitle && p.title && (
                    <div className="tile-text">
                      <span className="tile-title">{p.title}</span>
                    </div>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="site-foot">© {settings.title}</footer>
    </div>
  );
}
