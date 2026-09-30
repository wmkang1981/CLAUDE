import { useState } from 'react';
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
import { CroppedImage } from '../shared/CroppedImage';
import { STORE_LABEL, imageSrc, type Product } from '../shared/types';

type Props = {
  products: Product[];
  onEdit: (p: Product) => void;
  onNew: (image?: File) => void;
  onReorder: (next: Product[]) => void;
  onToggleHidden: (p: Product) => void;
};

function Row({ p, onEdit, onToggleHidden }: { p: Product; onEdit: () => void; onToggleHidden: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const src = imageSrc(p);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`pl-row${isDragging ? ' dragging' : ''}${p.hidden ? ' hidden' : ''}`}
    >
      <button type="button" className="pl-handle" title="잡고 위아래로 끌어서 순서 바꾸기" {...attributes} {...listeners}>
        ☰
      </button>
      <button type="button" className="pl-main" onClick={onEdit} title="눌러서 수정하기">
        <span className="pl-thumb">{src ? <CroppedImage src={src} crop={p.crop} alt="" /> : null}</span>
        <span className="pl-info">
          <span className="pl-title">
            {p.num !== null && <b className="pl-num">{p.num}</b>}
            {p.title || '(이름 없음)'}
          </span>
          <span className="pl-meta">
            <span className={`pl-store store-${p.store}`}>{STORE_LABEL[p.store]}</span>
            {p.category && <span>{p.category}</span>}
            {p.soldout && <span className="pl-flag">품절</span>}
            {!p.link && <span className="pl-flag">링크 없음</span>}
            <span>👆 클릭 {p.clicks ?? 0}</span>
          </span>
        </span>
      </button>
      <button type="button" className={`pl-eye${p.hidden ? ' off' : ''}`} onClick={onToggleHidden} title={p.hidden ? '숨김 → 보이게 하기' : '보임 → 숨기기'}>
        {p.hidden ? '숨김' : '보임'}
      </button>
    </li>
  );
}

export function ProductList({ products, onEdit, onNew, onReorder, onToggleHidden }: Props) {
  const [over, setOver] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = products.findIndex((p) => p.id === active.id);
    const to = products.findIndex((p) => p.id === over.id);
    onReorder(arrayMove(products, from, to));
  };

  return (
    <div className="pl">
      <button
        type="button"
        className={`drop new${over ? ' over' : ''}`}
        onClick={() => onNew()}
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes('Files')) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
          onNew(file);
        }}
      >
        <strong>＋ 새 상품 추가</strong>
        <span>눌러서 시작하거나, 상품 사진을 여기로 끌어다 놓으세요</span>
      </button>

      <p className="pl-tip">
        총 {products.length}개 · 왼쪽 <b>☰</b>를 잡고 끌면 순서가 바뀌어요 (위에 있을수록 먼저 보여요)
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="pl-list">
            {products.map((p) => (
              <Row key={p.id} p={p} onEdit={() => onEdit(p)} onToggleHidden={() => onToggleHidden(p)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
