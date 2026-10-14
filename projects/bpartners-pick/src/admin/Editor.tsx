import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { type Area, type MediaSize } from 'react-easy-crop';
import { TILE_ASPECT, detectStore, imageSrc, noteTextColor, type Category, type Product } from '../shared/types';
import { adminApi } from './api';
import { imageUrlFromDrop, prepareImage } from './imageUtils';
import { BOOKMARKLET, cleanTitle, parseImport, type Imported } from './bookmarklet';

export type Draft = Product & { imageBlob?: Blob };

type Props = {
  draft: Draft;
  isNew: boolean;
  categories: Category[];
  onManageCategories: () => void;
  /** baseline=true: 사진을 처음 열 때 자동으로 계산된 위치 (사용자가 고친 게 아님) */
  onChange: (d: Draft, baseline?: boolean) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onDelete: () => Promise<void>;
  notify: (msg: string, kind?: 'ok' | 'err') => void;
};

/** 사진 전체가 칸 안에 다 보이는 확대 비율 */
function containZoom(media: MediaSize | null): number {
  if (!media) return 0.5;
  const r = media.naturalWidth / media.naturalHeight;
  return Math.min(r / TILE_ASPECT, TILE_ASPECT / r);
}

export function Editor({ draft, isNew, categories, onManageCategories, onChange, onSave, onCancel, onDelete, notify }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [media, setMedia] = useState<MediaSize | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'fetch' | 'image' | 'delete'>('');
  const [dragOver, setDragOver] = useState(false);
  const [fetchedImage, setFetchedImage] = useState<string | null>(null);
  const [showHowto, setShowHowto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const src = imageSrc(draft);
  const set = (patch: Partial<Draft>) => onChange({ ...draftRef.current, ...patch });

  const applyImage = useCallback(
    async (blob: Blob) => {
      setBusy('image');
      try {
        const prepared = await prepareImage(blob);
        if (draftRef.current.localImage) URL.revokeObjectURL(draftRef.current.localImage);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setMedia(null);
        onChange({ ...draftRef.current, imageBlob: prepared, localImage: URL.createObjectURL(prepared), crop: null });
      } catch (e) {
        notify((e as Error).message, 'err');
      } finally {
        setBusy('');
      }
    },
    [onChange, notify],
  );

  const applyImageUrl = useCallback(
    async (url: string) => {
      setBusy('image');
      try {
        await applyImage(await adminApi.proxyImage(url));
      } catch (e) {
        notify((e as Error).message + ' 사진을 저장한 뒤 직접 올려주세요.', 'err');
        setBusy('');
      }
    },
    [applyImage, notify],
  );

  // 📌 담기 버튼으로 가져온 이름·사진 넣기
  const applyImport = useCallback(
    async (imp: Imported) => {
      if (imp.title) onChange({ ...draftRef.current, title: imp.title });
      if (imp.image) await applyImageUrl(imp.image);
      notify(imp.image ? '📌 쿠팡 페이지에서 이름·사진을 가져왔어요.' : '📌 이름을 가져왔어요. 사진은 직접 넣어주세요.');
    },
    [onChange, applyImageUrl, notify],
  );

  // Ctrl+V 로 사진 붙여넣기 (또는 📌 담기 버튼으로 복사한 상품 정보)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const imp = parseImport(e.clipboardData?.getData('text') ?? '');
      if (imp) {
        e.preventDefault();
        void applyImport(imp);
        return;
      }
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void applyImage(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [applyImage, applyImport]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) return void applyImage(file);
    const url = imageUrlFromDrop(e.dataTransfer);
    if (url) return void applyImageUrl(url);
    notify('사진 파일을 끌어다 놓아 주세요.', 'err');
  };

  const fetchFromLink = async () => {
    const link = draft.link.trim();
    if (!link) return notify('먼저 구매 링크를 붙여넣어 주세요.', 'err');
    setBusy('fetch');
    setFetchedImage(null);
    try {
      const meta = await adminApi.fetchMeta(link);
      if (!meta.ok || (!meta.image && !meta.title)) {
        setShowHowto(true);
        notify(
          `쇼핑몰이 서버 접속을 막았어요${meta.status ? ` (${meta.status})` : ''}. 아래 "📌 담기 버튼" 방법을 써주세요.`,
          'err',
        );
        return;
      }
      if (meta.title && !draftRef.current.title) set({ title: cleanTitle(meta.title) });
      if (meta.image) {
        if (src) setFetchedImage(meta.image);
        else await applyImageUrl(meta.image);
      }
      notify(meta.image || meta.title ? '링크에서 정보를 가져왔어요.' : '가져올 정보가 없었어요. 직접 입력해 주세요.', meta.image || meta.title ? 'ok' : 'err');
    } catch (e) {
      notify((e as Error).message, 'err');
    } finally {
      setBusy((b) => (b === 'fetch' ? '' : b));
    }
  };

  const baselineSrc = useRef<string | null>(null);
  const onCropArea = useCallback(
    (area: Area) => {
      const d = draftRef.current;
      const first = baselineSrc.current !== imageSrc(d);
      baselineSrc.current = imageSrc(d);
      const c = d.crop;
      if (c && c.x === area.x && c.y === area.y && c.width === area.width && c.height === area.height) return;
      onChange({ ...d, crop: area }, first);
    },
    [onChange],
  );

  const minZoom = Math.min(1, containZoom(media) * 0.8);
  const store = detectStore(draft.link);
  const notPartnerCoupang = store === 'coupang' && /(^|\.)coupang\.com$/i.test(safeHost(draft.link)) && !/^link\.coupang\.com$/i.test(safeHost(draft.link));

  const save = async () => {
    setBusy('save');
    try {
      await onSave();
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="ed">
      <div className="ed-head">
        <button type="button" className="btn ghost" onClick={onCancel}>
          ← 목록으로
        </button>
        <h2>{isNew ? '새 상품 추가' : '상품 수정'}</h2>
      </div>

      {/* 1. 구매 링크 */}
      <label className="field">
        <span className="field-label">① 구매 링크 (파트너스 / 쇼핑 커넥트 링크)</span>
        <div className="row">
          <input
            type="url"
            placeholder="https://link.coupang.com/a/..."
            value={draft.link}
            onChange={(e) => set({ link: e.target.value, store: detectStore(e.target.value) })}
          />
          <button type="button" className="btn" onClick={fetchFromLink} disabled={busy !== ''}>
            {busy === 'fetch' ? '가져오는 중…' : '링크에서 사진·이름 가져오기'}
          </button>
        </div>
        {draft.link && (
          <span className={`field-help ${store === 'other' ? 'warn' : 'ok'}`}>
            {store === 'coupang' && '✅ 쿠팡 링크로 인식했어요'}
            {store === 'naver' && '✅ 네이버 링크로 인식했어요'}
            {store === 'other' && 'ℹ️ 쿠팡·네이버가 아닌 링크예요 ("구매" 표시로 보여요)'}
          </span>
        )}
        {notPartnerCoupang && (
          <span className="field-help warn">⚠️ 일반 쿠팡 주소 같아요. 파트너스에서 만든 링크(link.coupang.com)를 넣어야 수수료가 들어와요.</span>
        )}
      </label>

      <details className="howto" open={showHowto} onToggle={(e) => setShowHowto((e.target as HTMLDetailsElement).open)}>
        <summary>🤔 자동으로 안 가져와지나요? → 📌 담기 버튼 쓰는 법</summary>
        <p className="howto-why">쿠팡·네이버는 서버에서 들어오는 접속을 막을 때가 있어요. 그럴 땐 내 브라우저에서 직접 가져오면 돼요.</p>
        <ol>
          <li>
            <b>처음 한 번만:</b> 이 버튼을 마우스로 잡고 <b>브라우저 위쪽 즐겨찾기 줄</b>로 끌어다 놓으세요.{' '}
            <a
              className="bm-btn"
              ref={(el) => el?.setAttribute('href', BOOKMARKLET)}
              onClick={(e) => {
                e.preventDefault();
                notify('이 버튼은 누르는 게 아니라, 즐겨찾기 줄로 끌어다 놓는 거예요.', 'err');
              }}
              draggable
            >
              📌 B.Pick 담기
            </a>
            <br />
            <span className="howto-sub">즐겨찾기 줄이 안 보이면 키보드 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd></span>
          </li>
          <li>
            <button
              type="button"
              className="btn small"
              disabled={!/^https?:\/\//i.test(draft.link.trim())}
              onClick={() => window.open(draft.link.trim(), '_blank', 'noopener')}
            >
              🛒 쇼핑몰에서 열기
            </button>{' '}
            를 눌러 상품 페이지를 열어요.
          </li>
          <li>
            상품 페이지에서 즐겨찾기 줄의 <b>📌 B.Pick 담기</b>를 눌러요. "담았어요" 창이 뜨면 확인.
          </li>
          <li>
            이 화면으로 돌아와 <kbd>Ctrl</kbd>+<kbd>V</kbd> → 이름과 사진이 들어가요.
          </li>
        </ol>
        <p className="howto-sub">
          사진만 안 들어오면: 쇼핑몰 사진에서 <b>마우스 오른쪽 클릭 → 이미지 복사</b> → 여기서 <kbd>Ctrl</kbd>+<kbd>V</kbd>
        </p>
      </details>

      {/* 2. 사진 */}
      <div className="field">
        <span className="field-label">② 사진 — 휴대폰 화면에 보일 모양을 맞춰주세요</span>
        {src ? (
          <>
            <div
              className={`crop-box${dragOver ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <Cropper
                key={src}
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={TILE_ASPECT}
                minZoom={minZoom}
                maxZoom={5}
                zoomSpeed={0.15}
                restrictPosition={false}
                objectFit="contain"
                showGrid
                initialCroppedAreaPercentages={draft.crop ?? undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropAreaChange={onCropArea}
                onCropComplete={onCropArea}
                onMediaLoaded={setMedia}
                style={{ containerStyle: { background: '#2b2d33' }, mediaStyle: { background: '#fff' } }}
              />
            </div>
            <div className="zoom-row">
              <span>축소</span>
              <input
                type="range"
                min={minZoom}
                max={5}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="확대/축소"
              />
              <span>확대</span>
            </div>
            <div className="row wrap">
              <button type="button" className="btn small" onClick={() => { setZoom(1); setCrop({ x: 0, y: 0 }); }}>
                꽉 채우기
              </button>
              <button type="button" className="btn small" onClick={() => { setZoom(containZoom(media)); setCrop({ x: 0, y: 0 }); }}>
                전체 보이기
              </button>
              <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
                다른 사진으로 바꾸기
              </button>
              {fetchedImage && (
                <button type="button" className="btn small accent" onClick={() => { void applyImageUrl(fetchedImage); setFetchedImage(null); }}>
                  링크의 대표 사진 쓰기
                </button>
              )}
            </div>
            <p className="field-help">사진을 끌어서 위치를 옮기고, 마우스 휠이나 막대로 크기를 바꿔요. 왼쪽 휴대폰 화면에 바로 보여요.</p>
          </>
        ) : (
          <button
            type="button"
            className={`drop${dragOver ? ' over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            disabled={busy === 'image'}
          >
            <strong>{busy === 'image' ? '사진 준비 중…' : '📷 사진을 여기로 끌어다 놓으세요'}</strong>
            <span>또는 클릭해서 고르기 · 복사한 사진은 Ctrl+V 로 붙여넣기</span>
            <span>쇼핑몰 탭의 상품 사진을 바로 끌어와도 돼요</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void applyImage(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* 3. 정보 */}
      <div className="grid2">
        <label className="field">
          <span className="field-label">③ 번호 (릴스에 적을 번호)</span>
          <input
            type="number"
            inputMode="numeric"
            value={draft.num ?? ''}
            onChange={(e) => set({ num: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </label>
        <div className="field">
          <span className="field-label">카테고리 (왼쪽 포스트잇)</span>
          {categories.length === 0 ? (
            <button type="button" className="btn" onClick={onManageCategories}>
              🏷️ 카테고리 먼저 만들기
            </button>
          ) : (
            <div className="cat-pick" role="radiogroup" aria-label="카테고리">
              <button
                type="button"
                className={`cat-chip${!draft.category ? ' on' : ''}`}
                onClick={() => set({ category: '' })}
                aria-pressed={!draft.category}
              >
                없음
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cat-chip${draft.category === c.id ? ' on' : ''}`}
                  style={{ background: c.color, color: noteTextColor(c.color) }}
                  onClick={() => set({ category: c.id })}
                  aria-pressed={draft.category === c.id}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <label className="field">
        <span className="field-label">상품 이름</span>
        <input value={draft.title} placeholder="예: 스텐 원터치 텀블러 500ml" onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="row wrap checks">
        <label>
          <input type="checkbox" checked={draft.soldout} onChange={(e) => set({ soldout: e.target.checked })} /> 품절 표시
        </label>
        <label>
          <input type="checkbox" checked={draft.hidden} onChange={(e) => set({ hidden: e.target.checked })} /> 손님 화면에서 숨기기
        </label>
      </div>

      <div className="ed-actions">
        <button type="button" className="btn primary big" onClick={save} disabled={busy !== ''}>
          {busy === 'save' ? '저장 중…' : '💾 저장하기'}
        </button>
        <button type="button" className="btn big" onClick={onCancel} disabled={busy === 'save'}>
          취소
        </button>
        {!isNew && (
          <button
            type="button"
            className="btn danger big"
            disabled={busy !== ''}
            onClick={async () => {
              if (!confirm('이 상품을 지울까요? 되돌릴 수 없어요.')) return;
              setBusy('delete');
              try {
                await onDelete();
              } finally {
                setBusy('');
              }
            }}
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

function safeHost(link: string): string {
  try {
    return new URL(link).hostname;
  } catch {
    return '';
  }
}
