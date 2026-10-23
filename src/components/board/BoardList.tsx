import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ListWithCards, BoardCardWithId } from '../../collab/useYBoard';
import { BoardCard } from './BoardCard';

interface BoardListProps {
  list: ListWithCards;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRenameList: (id: string, next: string) => void;
  onDeleteList: (id: string) => void;
  onAddCard: (listId: string, title: string) => void;
  onOpenCard: (card: BoardCardWithId) => void;
  onToggleCardDone: (cardId: string) => void;
  onToggleCardFlag: (cardId: string) => void;
  onCardHover: (cardId: string | null) => void;
  remoteColorByCardId: Map<string, string>;
  labelNames: Record<string, string>;
  quickFlagColor: string;
  flagKeybindHint?: string;
  doneColor: string;
  doneKeybindHint?: string;
}

export function BoardList({
  list,
  collapsed,
  onToggleCollapsed,
  onRenameList,
  onDeleteList,
  onAddCard,
  onOpenCard,
  onToggleCardDone,
  onToggleCardFlag,
  onCardHover,
  remoteColorByCardId,
  labelNames,
  quickFlagColor,
  flagKeybindHint,
  doneColor,
  doneKeybindHint,
}: BoardListProps) {
  const sortable = useSortable({ id: list.id, data: { kind: 'list' } });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  const totalCount = list.cards.length;
  const doneCount = list.cards.filter((c) => c.done).length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  if (collapsed) {
    return (
      <div
        ref={sortable.setNodeRef}
        style={style}
        className="shrink-0 w-12 bg-gray-100 rounded-lg flex flex-col items-stretch py-2 dnd-handle"
        data-list-droppable={list.id}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex-1 flex flex-col items-center gap-1 text-xs text-ink hover:bg-gray-200/60 rounded mx-1 py-2"
          title={`Expand "${list.title}" (${doneCount}/${totalCount})`}
        >
          <span className="text-base">⤢</span>
          <span
            className="font-medium [writing-mode:vertical-rl] [text-orientation:mixed] truncate max-h-32"
            aria-label={list.title}
          >
            {list.title}
          </span>
          <span
            className={`text-[10px] tabular-nums ${allDone ? 'text-emerald-600 font-medium' : 'text-muted'}`}
          >
            {doneCount}/{totalCount}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className="shrink-0 w-72 bg-gray-100 rounded-lg flex flex-col max-h-full"
      data-list-droppable={list.id}
    >
      <ListHeader
        title={list.title}
        listId={list.id}
        doneCount={doneCount}
        totalCount={totalCount}
        onRename={(next) => onRenameList(list.id, next)}
        onDelete={() => onDeleteList(list.id)}
        onCollapse={onToggleCollapsed}
        dragHandleProps={{ ...sortable.attributes, ...sortable.listeners }}
      />

      <SortableContext
        items={list.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[8px]"
          data-list-id={list.id}
        >
          {list.cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              onOpen={() => onOpenCard(card)}
              onToggleDone={() => onToggleCardDone(card.id)}
              onToggleQuickFlag={() => onToggleCardFlag(card.id)}
              onHoverChange={(hovered) => onCardHover(hovered ? card.id : null)}
              remoteColor={remoteColorByCardId.get(card.id)}
              labelNames={labelNames}
              flagColor={quickFlagColor}
              flagKeybindHint={flagKeybindHint}
              doneColor={doneColor}
              doneKeybindHint={doneKeybindHint}
            />
          ))}
        </div>
      </SortableContext>

      <AddCardFooter onAdd={(title) => onAddCard(list.id, title)} />
    </div>
  );
}

function DraggableCard({
  card,
  onOpen,
  remoteColor,
  onToggleDone,
  onToggleQuickFlag,
  onHoverChange,
  labelNames,
  flagColor,
  flagKeybindHint,
  doneColor,
  doneKeybindHint,
}: {
  card: BoardCardWithId;
  onOpen: () => void;
  remoteColor?: string;
  onToggleDone?: () => void;
  onToggleQuickFlag?: () => void;
  onHoverChange?: (hovered: boolean) => void;
  labelNames: Record<string, string>;
  flagColor: string;
  flagKeybindHint?: string;
  doneColor: string;
  doneKeybindHint?: string;
}) {
  const sortable = useSortable({ id: card.id, data: { kind: 'card', listId: card.listId } });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  // We can't put onClick on a button that also has drag listeners — pointer-down
  // gets captured by dnd-kit. Solution: click only fires if no drag happened.
  const downAtRef = useRef<{ x: number; y: number } | null>(null);

  const pointerHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      downAtRef.current = { x: e.clientX, y: e.clientY };
      sortable.listeners?.onPointerDown?.(e);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const start = downAtRef.current;
      downAtRef.current = null;
      if (!start) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx < 4 && dy < 4 && !sortable.isDragging) {
        onOpen();
      }
    },
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className="dnd-handle"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <BoardCard
        card={card}
        onOpen={onOpen}
        onToggleDone={onToggleDone}
        onToggleQuickFlag={onToggleQuickFlag}
        flagColor={flagColor}
        flagKeybindHint={flagKeybindHint}
        doneColor={doneColor}
        doneKeybindHint={doneKeybindHint}
        remoteColor={remoteColor}
        isDragging={sortable.isDragging}
        labelNames={labelNames}
        dragHandleProps={{
          ...sortable.attributes,
          ...pointerHandlers,
        }}
      />
    </div>
  );
}

function ListHeader({
  title,
  listId,
  doneCount,
  totalCount,
  onRename,
  onDelete,
  onCollapse,
  dragHandleProps,
}: {
  title: string;
  listId: string;
  doneCount: number;
  totalCount: number;
  onRename: (next: string) => void;
  onDelete: () => void;
  onCollapse: () => void;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const allDone = totalCount > 0 && doneCount === totalCount;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  // Close the menu on outside click / Escape — mouseLeave alone doesn't work
  // on touch and leaves the menu open after the pointer leaves the card.
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, closeMenu]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === title) return;
    onRename(next.slice(0, 64));
  };

  // The whole header acts as the drag handle so users can grab anywhere on it,
  // not just the title text. Buttons/inputs inside still work because the
  // PointerSensor only starts a drag after 5px of movement.
  return (
    <div
      {...(!editing ? dragHandleProps : {})}
      className={`dnd-handle px-2.5 py-2 flex items-center gap-1.5 select-none ${
        !editing ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 64))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setDraft(title);
              setEditing(false);
            }
          }}
          className="flex-1 text-sm font-medium border border-stroke rounded px-1.5 py-0.5"
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          className="flex-1 text-sm font-medium text-ink truncate px-1 py-0.5"
          title={`${title} — drag the header to reorder, double-click to rename`}
        >
          {title}
        </div>
      )}
      <span
        className={`text-[11px] tabular-nums px-1 ${
          allDone ? 'text-emerald-600 font-medium' : 'text-muted'
        }`}
        title={`${doneCount} done of ${totalCount}`}
      >
        {doneCount}/{totalCount}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="text-muted hover:text-ink px-1 py-0.5 rounded"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`List options for ${title}`}
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 z-10 w-44 bg-white border border-stroke rounded-md shadow-card text-sm overflow-hidden"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setEditing(true);
                setMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-1.5 hover:bg-gray-100"
            >
              Rename list
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCollapse();
                setMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-1.5 hover:bg-gray-100"
            >
              Collapse list
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                const confirmed = window.confirm(
                  `Delete list "${title}"? Its ${totalCount} card${totalCount === 1 ? '' : 's'} will be deleted too.`,
                );
                if (confirmed) onDelete();
              }}
              className="block w-full text-left px-3 py-1.5 hover:bg-gray-100 text-red-600"
            >
              Delete list
            </button>
          </div>
        )}
      </div>
      <span className="hidden" aria-hidden>
        {listId}
      </span>
    </div>
  );
}

function AddCardFooter({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setOpen(false);
      setText('');
      return;
    }
    onAdd(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="m-1.5 text-left text-sm text-muted hover:text-ink hover:bg-gray-200/60 rounded px-2 py-1.5 transition-colors"
      >
        + Add a card
      </button>
    );
  }

  return (
    <div className="p-2">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Card title"
        rows={2}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            setOpen(false);
            setText('');
          }
        }}
        className="w-full text-sm border border-stroke rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          className="text-sm px-3 py-1 rounded bg-ink text-white font-medium hover:bg-gray-800"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText('');
          }}
          className="text-sm text-muted hover:text-ink px-1"
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
