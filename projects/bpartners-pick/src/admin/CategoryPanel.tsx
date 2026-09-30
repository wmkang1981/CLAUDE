import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NOTE_COLORS, noteTextColor, type Category } from '../shared/types';

type Props = {
  categories: Category[];
  counts: Map<string, number>;
  onChange: (c: Category[]) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
};

const EXAMPLES: [string, string][] = [
  ['생활', '#ffe66d'],
  ['음식', '#ffb3c7'],
  ['스포츠', '#a7d8ff'],
  ['뷰티', '#d7c2ff'],
];

let tempId = 0;
const newId = () => `new-${Date.now()}-${++tempId}`;

function Row({
  c,
  count,
  onPatch,
  onDelete,
}: {
  c: Category;
  count: number;
  onPatch: (patch: Partial<Category>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cat-row${isDragging ? ' dragging' : ''}`}
    >
      <button type="button" className="pl-handle" title="잡고 위아래로 끌어서 순서 바꾸기" {...attributes} {...listeners}>
        ☰
      </button>
      <div className="cat-body">
        <div className="cat-top">
          <span className="cat-preview" style={{ background: c.color, color: noteTextColor(c.color) }}>
            {c.name || '이름'}
          </span>
          <input
            className="cat-name"
            value={c.name}
            maxLength={12}
            placeholder="카테고리 이름 (예: 생활)"
            onChange={(e) => onPatch({ name: e.target.value })}
            aria-label="카테고리 이름"
          />
          <span className="cat-count">상품 {count}개</span>
          <button
            type="button"
            className="btn small danger"
            onClick={() => {
              if (count > 0 && !confirm(`"${c.name}"를 지울까요?\n안에 있던 상품 ${count}개는 지워지지 않고 "전체"에서만 보여요.`)) return;
              onDelete();
            }}
          >
            삭제
          </button>
        </div>
        <div className="cat-colors" role="group" aria-label="포스트잇 색상">
          {NOTE_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              className={`swatch${c.color === col ? ' on' : ''}`}
              style={{ background: col }}
              onClick={() => onPatch({ color: col })}
              aria-label={`색상 ${col}`}
            />
          ))}
          <label className="swatch custom" title="원하는 색 고르기">
            <input type="color" value={c.color} onChange={(e) => onPatch({ color: e.target.value })} aria-label="원하는 색 고르기" />
            🎨
          </label>
        </div>
      </div>
    </li>
  );
}

export function CategoryPanel({ categories, counts, onChange, onSave, saving, dirty }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const patch = (id: string, p: Partial<Category>) => onChange(categories.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const add = () =>
    onChange([...categories, { id: newId(), name: '', color: NOTE_COLORS[categories.length % (NOTE_COLORS.length - 1)] }]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = categories.findIndex((c) => c.id === active.id);
    const to = categories.findIndex((c) => c.id === over.id);
    onChange(arrayMove(categories, from, to));
  };

  return (
    <div className="ed">
      <p className="pl-tip">
        손님 화면 <b>왼쪽에 포스트잇</b>으로 보여요. 맨 위에는 항상 <b>“전체”</b>가 있어요.
        <br />왼쪽 <b>☰</b>를 잡고 끌면 순서가 바뀌어요. 바꾼 뒤 아래 <b>저장</b>을 눌러야 손님 화면에 반영돼요.
      </p>

      {categories.length === 0 && (
        <div className="cat-empty">
          <p>아직 카테고리가 없어요. 카테고리가 없으면 상품이 화면 가득 보여요.</p>
          <button
            type="button"
            className="btn"
            onClick={() => onChange(EXAMPLES.map(([name, color]) => ({ id: newId(), name, color })))}
          >
            예시 넣기 (생활·음식·스포츠·뷰티)
          </button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="pl-list">
            {categories.map((c) => (
              <Row
                key={c.id}
                c={c}
                count={counts.get(c.id) ?? 0}
                onPatch={(p) => patch(c.id, p)}
                onDelete={() => onChange(categories.filter((x) => x.id !== c.id))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <button type="button" className="drop new cat-add" onClick={add} disabled={categories.length >= 50}>
        <strong>＋ 카테고리 추가</strong>
      </button>

      <div className="ed-actions">
        <button type="button" className="btn primary big" onClick={onSave} disabled={saving || !dirty}>
          {saving ? '저장 중…' : dirty ? '💾 카테고리 저장하기' : '저장됨 ✓'}
        </button>
      </div>
    </div>
  );
}
