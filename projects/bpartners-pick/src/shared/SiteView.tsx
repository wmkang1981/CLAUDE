import { useMemo, useState } from 'react';
import { CroppedImage } from './CroppedImage';
import { STORE_LABEL, imageSrc, matchesQuery, noteTextColor, type Category, type Product, type Settings } from './types';

type Props = {
  settings: Settings;
  categories: Category[];
  products: Product[];
  /** 관리자 미리보기: 사진을 눌러도 쇼핑몰로 가지 않고 편집을 열어요 */
  onSelect?: (p: Product) => void;
  selectedId?: string | null;
};

const ALL = '';

export function SiteView({ settings, categories, products, onSelect, selectedId }: Props) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(ALL);

  const nameOf = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  // 지워진 카테고리를 고르고 있었다면 "전체"로 돌아가요
  const category = categories.some((c) => c.id === picked) ? picked : ALL;
  const searching = query.trim() !== '';
  // 검색할 때는 카테고리와 상관없이 전체에서 찾아요 (릴스 번호로 바로 찾기)
  const shown = products.filter((p) =>
    searching ? matchesQuery(p, query, nameOf.get(p.category)) : !category || p.category === category,
  );
  const showTitle = settings.showTitle !== '0';
  const hasRail = categories.length > 0;

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

  const note = (id: string, name: string, color: string, i: number) => (
    <li key={id || 'all'}>
      <button
        type="button"
        className={`note${category === id && !searching ? ' on' : ''}`}
        style={{ '--note': color, '--note-text': noteTextColor(color), '--tilt': `${i % 2 ? 1.2 : -1.2}deg` } as React.CSSProperties}
        onClick={() => {
          setPicked(id);
          setQuery('');
        }}
        aria-pressed={category === id && !searching}
      >
        {name}
      </button>
    </li>
  );

  const grid =
    shown.length === 0 ? (
      <p className="site-empty">
        {products.length === 0
          ? '아직 등록된 상품이 없어요.'
          : searching
            ? '찾는 상품이 없어요. 번호를 다시 확인해 주세요.'
            : '이 카테고리에는 아직 상품이 없어요.'}
      </p>
    ) : (
      <ul className="site-grid">
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
    );

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

      {hasRail ? (
        <div className="site-body">
          <nav className="rail" aria-label="카테고리">
            <ul>
              {note(ALL, '전체', '#ffffff', 0)}
              {categories.map((c, i) => note(c.id, c.name, c.color, i + 1))}
            </ul>
          </nav>
          <div className="site-main">
            {searching && <p className="site-searchnote">전체 상품에서 찾은 결과예요</p>}
            {grid}
          </div>
        </div>
      ) : (
        <div className="site-main solo">{grid}</div>
      )}

      <footer className="site-foot">© {settings.title}</footer>
    </div>
  );
}
