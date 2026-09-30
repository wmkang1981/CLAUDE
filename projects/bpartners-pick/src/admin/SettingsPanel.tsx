import type { Settings } from '../shared/types';

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
};

export function SettingsPanel({ settings, onChange, onSave, saving, dirty }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div className="ed">
      <label className="field">
        <span className="field-label">사이트 이름 (맨 위 큰 글씨)</span>
        <input value={settings.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">소개 문구 (이름 아래 작은 글씨)</span>
        <input value={settings.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">수수료 안내 문구 (꼭 필요해요 · 지우지 마세요)</span>
        <textarea rows={3} value={settings.disclosure} onChange={(e) => set({ disclosure: e.target.value })} />
        {!settings.disclosure.trim() && (
          <span className="field-help warn">⚠️ 비워두면 쿠팡 파트너스 규정·공정위 지침 위반이 될 수 있어요.</span>
        )}
      </label>
      <div className="field">
        <span className="field-label">한 줄에 보일 사진 수</span>
        <div className="row">
          {(['2', '3'] as const).map((c) => (
            <button key={c} type="button" className={`btn${settings.columns === c ? ' primary' : ''}`} onClick={() => set({ columns: c })}>
              {c}칸
            </button>
          ))}
        </div>
      </div>
      <label className="row checks">
        <input type="checkbox" checked={settings.showTitle !== '0'} onChange={(e) => set({ showTitle: e.target.checked ? '1' : '0' })} />
        사진 아래에 상품 이름 보이기
      </label>
      <div className="ed-actions">
        <button type="button" className="btn primary big" onClick={onSave} disabled={saving || !dirty}>
          {saving ? '저장 중…' : dirty ? '💾 설정 저장하기' : '저장됨 ✓'}
        </button>
      </div>
    </div>
  );
}
