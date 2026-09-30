import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SiteView } from '../shared/SiteView';
import type { Category, Product, Settings } from '../shared/types';
import { ApiError, adminApi } from './api';
import { Editor, type Draft } from './Editor';
import { ProductList } from './ProductList';
import { SettingsPanel } from './SettingsPanel';
import { CategoryPanel } from './CategoryPanel';
import { prepareImage } from './imageUtils';
import '../shared/site.css';
import './admin.css';

const NEW_ID = '__new__';

type Toast = { id: number; msg: string; kind: 'ok' | 'err' };

function Login({ passwordSet, onDone }: { passwordSet: boolean; onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr('');
          try {
            await adminApi.login(pw);
            onDone();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>🛍️ B.Partners Pick 관리자</h1>
        {!passwordSet && (
          <p className="field-help warn">
            아직 관리자 비밀번호가 설정되지 않았어요. 설명서(README)의 “관리자 비밀번호 정하기”를 먼저 해주세요.
          </p>
        )}
        <label className="field">
          <span className="field-label">관리자 비밀번호</span>
          <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <p className="field-help warn">{err}</p>}
        <button className="btn primary big" disabled={busy || !pw}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}

function emptyDraft(products: Product[]): Draft {
  const maxNum = products.reduce((m, p) => Math.max(m, p.num ?? 0), 0);
  return {
    id: NEW_ID,
    num: maxNum + 1,
    title: '',
    category: '',
    link: '',
    store: 'other',
    image_id: null,
    crop: null,
    hidden: false,
    soldout: false,
    sort: -Infinity,
  };
}

function Dashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savedSettings, setSavedSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [savedCategories, setSavedCategories] = useState<Category[] | null>(null);
  const [savingCategories, setSavingCategories] = useState(false);
  const [tab, setTab] = useState<'products' | 'categories' | 'settings'>('products');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftBase, setDraftBase] = useState<Draft | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 2500);
  }, []);

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) return onLoggedOut();
      notify((e as Error).message, 'err');
    },
    [notify, onLoggedOut],
  );

  useEffect(() => {
    Promise.all([adminApi.products(), adminApi.site()])
      .then(([p, s]) => {
        setProducts(p.products);
        setSettings(s.settings);
        setSavedSettings(s.settings);
        setCategories(s.categories ?? []);
        setSavedCategories(s.categories ?? []);
      })
      .catch(handleError);
  }, [handleError]);

  const draftKey = (d: Draft | null) => (d ? JSON.stringify({ ...d, imageBlob: undefined }) : '');
  const dirty = !!draft && ((draft.id === NEW_ID && !!draft.imageBlob) || draftKey(draft) !== draftKey(draftBase));

  const changeDraft = useCallback((d: Draft, baseline?: boolean) => {
    setDraft(d);
    // 사진을 처음 열 때 자동으로 맞춰진 위치는 "고친 것"으로 치지 않아요
    if (baseline) setDraftBase((b) => (b && b.localImage === d.localImage && b.image_id === d.image_id ? { ...b, crop: d.crop } : b));
  }, []);

  const confirmLeave = () => !dirty || confirm('저장하지 않은 내용이 있어요. 그래도 나갈까요?');

  const openDraft = (d: Draft) => {
    if (draft?.localImage) URL.revokeObjectURL(draft.localImage);
    setDraft(d);
    setDraftBase(d);
    setTab('products');
  };

  const startNew = async (file?: File) => {
    if (!products || !confirmLeave()) return;
    const d = emptyDraft(products);
    if (file) {
      try {
        const blob = await prepareImage(file);
        openDraft({ ...d, imageBlob: blob, localImage: URL.createObjectURL(blob) });
        return;
      } catch (e) {
        notify((e as Error).message, 'err');
      }
    }
    openDraft(d);
  };

  const editProduct = (p: Product) => {
    if (draft?.id === p.id || !confirmLeave()) return;
    openDraft({ ...p });
  };

  const closeDraft = () => {
    if (!confirmLeave()) return;
    if (draft?.localImage) URL.revokeObjectURL(draft.localImage);
    setDraft(null);
  };

  const saveDraft = async () => {
    if (!draft || !products) return;
    try {
      let image_id = draft.image_id;
      if (draft.imageBlob) image_id = (await adminApi.uploadImage(draft.imageBlob)).id;
      const payload = {
        num: draft.num,
        title: draft.title,
        category: draft.category,
        link: draft.link,
        image_id,
        crop: draft.crop,
        hidden: draft.hidden,
        soldout: draft.soldout,
      };
      if (draft.id === NEW_ID) {
        const { product } = await adminApi.create(payload);
        setProducts([product, ...products]);
      } else {
        const { product } = await adminApi.update(draft.id, payload);
        setProducts(products.map((p) => (p.id === product.id ? product : p)));
      }
      if (draft.localImage) URL.revokeObjectURL(draft.localImage);
      setDraft(null);
      notify('저장했어요! 손님 화면에 바로 반영돼요.');
    } catch (e) {
      handleError(e);
    }
  };

  const deleteDraft = async () => {
    if (!draft || !products) return;
    try {
      await adminApi.remove(draft.id);
      setProducts(products.filter((p) => p.id !== draft.id));
      if (draft.localImage) URL.revokeObjectURL(draft.localImage);
      setDraft(null);
      notify('지웠어요.');
    } catch (e) {
      handleError(e);
    }
  };

  const reorder = async (next: Product[]) => {
    const prev = products;
    setProducts(next);
    try {
      await adminApi.reorder(next.map((p) => p.id));
    } catch (e) {
      setProducts(prev);
      handleError(e);
    }
  };

  const toggleHidden = async (p: Product) => {
    if (!products) return;
    try {
      const { product } = await adminApi.update(p.id, { ...p, hidden: !p.hidden });
      setProducts(products.map((x) => (x.id === product.id ? product : x)));
    } catch (e) {
      handleError(e);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const { settings: s } = await adminApi.saveSettings(settings);
      setSettings(s);
      setSavedSettings(s);
      notify('설정을 저장했어요.');
    } catch (e) {
      handleError(e);
    } finally {
      setSavingSettings(false);
    }
  };

  const saveCategories = async () => {
    if (!categories) return;
    if (categories.some((c) => !c.name.trim())) return notify('이름이 빈 카테고리가 있어요.', 'err');
    setSavingCategories(true);
    try {
      const { categories: saved } = await adminApi.saveCategories(categories);
      setCategories(saved);
      setSavedCategories(saved);
      // 지운 카테고리에 있던 상품은 서버에서 "카테고리 없음"이 돼요 → 목록 새로 받기
      setProducts((await adminApi.products()).products);
      notify('카테고리를 저장했어요.');
    } catch (e) {
      handleError(e);
    } finally {
      setSavingCategories(false);
    }
  };

  const switchTab = (next: 'products' | 'categories' | 'settings') => {
    if (next !== 'products' && draft) {
      if (!confirmLeave()) return;
      if (draft.localImage) URL.revokeObjectURL(draft.localImage);
      setDraft(null);
    }
    setTab(next);
  };

  // 미리보기: 편집 중인 내용을 저장 전에도 바로 보여줘요
  const preview = useMemo(() => {
    if (!products) return [];
    if (!draft) return products;
    if (draft.id === NEW_ID) return [draft, ...products];
    return products.map((p) => (p.id === draft.id ? draft : p));
  }, [products, draft]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products ?? []) if (p.category) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [products]);

  if (!products || !settings || !savedSettings || !categories || !savedCategories) return <p className="loading">불러오는 중…</p>;
  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const categoriesDirty = JSON.stringify(categories) !== JSON.stringify(savedCategories);
  // 미리보기에는 이름을 적은 카테고리만 보여줘요
  const previewCategories = categories.filter((c) => c.name.trim());

  return (
    <div className="adm">
      <header className="adm-top">
        <strong>🛍️ {savedSettings.title} 관리자</strong>
        <div className="row">
          <a className="btn ghost" href="/" target="_blank" rel="noopener">
            내 사이트 열기 ↗
          </a>
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              if (!confirmLeave()) return;
              await adminApi.logout().catch(() => undefined);
              onLoggedOut();
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="adm-body">
        <section className="adm-left" aria-label="휴대폰 미리보기">
          <div className="phone">
            <div className="phone-notch" />
            <div className="phone-screen">
              <SiteView
                settings={settings}
                categories={previewCategories}
                products={preview}
                onSelect={editProduct}
                selectedId={draft?.id ?? null}
              />
            </div>
          </div>
          <p className="adm-hint">👆 미리보기 속 사진을 누르면 그 상품을 고칠 수 있어요 (여기선 쇼핑몰로 안 넘어가요)</p>
        </section>

        <section className="adm-right">
          <nav className="tabs">
            <button type="button" className={tab === 'products' ? 'on' : ''} onClick={() => switchTab('products')}>
              📦 상품
            </button>
            <button type="button" className={tab === 'categories' ? 'on' : ''} onClick={() => switchTab('categories')}>
              🏷️ 카테고리{categoriesDirty ? ' •' : ''}
            </button>
            <button type="button" className={tab === 'settings' ? 'on' : ''} onClick={() => switchTab('settings')}>
              ⚙️ 사이트 설정
            </button>
          </nav>

          {tab === 'categories' ? (
            <CategoryPanel
              categories={categories}
              counts={counts}
              onChange={setCategories}
              onSave={saveCategories}
              saving={savingCategories}
              dirty={categoriesDirty}
            />
          ) : tab === 'settings' ? (
            <SettingsPanel settings={settings} onChange={setSettings} onSave={saveSettings} saving={savingSettings} dirty={settingsDirty} />
          ) : draft ? (
            <Editor
              key={draft.id}
              draft={draft}
              isNew={draft.id === NEW_ID}
              categories={savedCategories}
              onManageCategories={() => switchTab('categories')}
              onChange={changeDraft}
              onSave={saveDraft}
              onCancel={closeDraft}
              onDelete={deleteDraft}
              notify={notify}
            />
          ) : (
            <ProductList products={products} categories={savedCategories} onEdit={editProduct} onNew={startNew} onReorder={reorder} onToggleHidden={toggleHidden} />
          )}
        </section>
      </div>

      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState<{ loggedIn: boolean; passwordSet: boolean } | null>(null);
  const check = useCallback(() => {
    adminApi
      .me()
      .then(setState)
      .catch(() => setState({ loggedIn: false, passwordSet: true }));
  }, []);
  useEffect(check, [check]);

  if (!state) return <p className="loading">불러오는 중…</p>;
  if (!state.loggedIn) return <Login passwordSet={state.passwordSet} onDone={check} />;
  return <Dashboard onLoggedOut={() => setState({ ...state, loggedIn: false })} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
