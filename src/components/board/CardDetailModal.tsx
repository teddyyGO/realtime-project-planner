import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardCardWithId } from '../../collab/useYBoard';
import { readChecklistGroups } from '../../collab/useYBoard';
import { ChecklistGroups } from './ChecklistGroups';
import { LabelPicker } from './LabelPicker';

interface CardDetailModalProps {
  card: BoardCardWithId;
  listTitle: string;
  onClose: () => void;
  onUpdateTitle: (text: string) => void;
  onUpdateDescription: (text: string) => void;
  onToggleLabel: (color: string) => void;
  labelNames: Record<string, string>;
  onRenameLabel: (color: string, name: string) => void;
  quickFlagColor: string;
  onSetQuickFlagColor: (color: string) => void;
  flagKeybind: string | null;
  onSetFlagKeybind: (key: string | null) => void;
  doneColor: string;
  onSetDoneColor: (color: string) => void;
  doneKeybind: string | null;
  onSetDoneKeybind: (key: string | null) => void;
  onSetDueDate: (iso: string | undefined) => void;
  onAddChecklistGroup: (title: string) => void;
  onRenameChecklistGroup: (groupId: string, title: string) => void;
  onRemoveChecklistGroup: (groupId: string) => void;
  onAddChecklistItem: (groupId: string, text: string) => void;
  onToggleChecklistItem: (groupId: string, id: string, done: boolean) => void;
  onUpdateChecklistItem: (groupId: string, id: string, text: string) => void;
  onRemoveChecklistItem: (groupId: string, id: string) => void;
  onToggleDone: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 8000;

export function CardDetailModal({
  card,
  listTitle,
  onClose,
  onUpdateTitle,
  onUpdateDescription,
  onToggleLabel,
  labelNames,
  onRenameLabel,
  quickFlagColor,
  onSetQuickFlagColor,
  flagKeybind,
  onSetFlagKeybind,
  doneColor,
  onSetDoneColor,
  doneKeybind,
  onSetDoneKeybind,
  onSetDueDate,
  onAddChecklistGroup,
  onRenameChecklistGroup,
  onRemoveChecklistGroup,
  onAddChecklistItem,
  onToggleChecklistItem,
  onUpdateChecklistItem,
  onRemoveChecklistItem,
  onToggleDone,
  onArchive,
  onDelete,
}: CardDetailModalProps) {
  // Local draft state — synced from props whenever the user is NOT actively
  // editing. Tracks a separate "dirty" flag per field so remote edits to the
  // same card don't get silently overwritten on blur/close.
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [descDraft, setDescDraft] = useState(card.description ?? '');
  const titleDirtyRef = useRef(false);
  const descDirtyRef = useRef(false);
  const lastCardIdRef = useRef(card.id);

  // Pull remote changes into the draft IF the user is not currently editing
  // that field.
  useEffect(() => {
    if (lastCardIdRef.current !== card.id) {
      // Switched to a different card — adopt the new card's values wholesale.
      setTitleDraft(card.title);
      setDescDraft(card.description ?? '');
      titleDirtyRef.current = false;
      descDirtyRef.current = false;
      lastCardIdRef.current = card.id;
      return;
    }
    if (!titleDirtyRef.current) setTitleDraft(card.title);
    if (!descDirtyRef.current) setDescDraft(card.description ?? '');
  }, [card.id, card.title, card.description]);

  const flushTitle = useCallback(() => {
    if (!titleDirtyRef.current) return;
    titleDirtyRef.current = false;
    const next = titleDraft.trim();
    if (!next) {
      setTitleDraft(card.title);
      return;
    }
    if (next === card.title) return;
    onUpdateTitle(next.slice(0, MAX_TITLE));
  }, [titleDraft, card.title, onUpdateTitle]);

  const flushDescription = useCallback(() => {
    if (!descDirtyRef.current) return;
    descDirtyRef.current = false;
    if (descDraft === (card.description ?? '')) return;
    onUpdateDescription(descDraft.slice(0, MAX_DESCRIPTION));
  }, [descDraft, card.description, onUpdateDescription]);

  // Always flush pending edits before unmounting. Covers Esc, click-outside,
  // and the Done button (none of which fire blur consistently when the modal
  // unmounts).
  const flushTitleRef = useRef(flushTitle);
  const flushDescRef = useRef(flushDescription);
  flushTitleRef.current = flushTitle;
  flushDescRef.current = flushDescription;
  useEffect(() => {
    return () => {
      flushTitleRef.current();
      flushDescRef.current();
    };
  }, []);

  const handleClose = useCallback(() => {
    flushTitle();
    flushDescription();
    onClose();
  }, [flushTitle, flushDescription, onClose]);

  // ---------- Keyboard + focus trap -----------------------------------
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  // Focus the first focusable element on mount, and trap Tab inside the modal.
  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
    const first = focusables()[0];
    if (first) first.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
  }, []);

  const labels = card.labels ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl max-h-[90vh] overflow-auto bg-white border border-stroke rounded-xl shadow-lg"
      >
        <header className="px-5 pt-4 pb-3 border-b border-stroke flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted">in list · {listTitle}</div>
            <input
              value={titleDraft}
              onChange={(e) => {
                titleDirtyRef.current = true;
                setTitleDraft(e.target.value.slice(0, MAX_TITLE));
              }}
              onBlur={flushTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="mt-0.5 w-full text-lg font-semibold text-ink bg-transparent focus:outline-none focus:bg-gray-50 rounded px-1 -mx-1"
              maxLength={MAX_TITLE}
              aria-label="Card title"
            />
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-muted hover:text-ink p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4 space-y-5">
          <Section label="Description">
            <textarea
              value={descDraft}
              onChange={(e) => {
                descDirtyRef.current = true;
                setDescDraft(e.target.value.slice(0, MAX_DESCRIPTION));
              }}
              onBlur={flushDescription}
              placeholder="Add a more detailed description…"
              rows={4}
              maxLength={MAX_DESCRIPTION}
              aria-label="Card description"
              className="w-full text-sm border border-stroke rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Section>

          <Section label="Labels">
            <LabelPicker
              selected={labels}
              labelNames={labelNames}
              onToggle={onToggleLabel}
              onRenameLabel={onRenameLabel}
              quickFlagColor={quickFlagColor}
              onSetQuickFlagColor={onSetQuickFlagColor}
              flagKeybind={flagKeybind}
              onSetFlagKeybind={onSetFlagKeybind}
              doneColor={doneColor}
              onSetDoneColor={onSetDoneColor}
              doneKeybind={doneKeybind}
              onSetDoneKeybind={onSetDoneKeybind}
            />
          </Section>

          <Section label="Due date">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={card.dueDate ?? ''}
                onChange={(e) => onSetDueDate(e.target.value || undefined)}
                className="text-sm border border-stroke rounded-md px-2 py-1.5"
                aria-label="Due date"
              />
              {card.dueDate && (
                <button
                  type="button"
                  onClick={() => onSetDueDate(undefined)}
                  className="text-xs text-muted hover:text-ink px-1"
                >
                  Clear
                </button>
              )}
            </div>
          </Section>

          <Section label="Checklists">
            <ChecklistGroups
              groups={readChecklistGroups(card)}
              onAddGroup={onAddChecklistGroup}
              onRenameGroup={onRenameChecklistGroup}
              onRemoveGroup={onRemoveChecklistGroup}
              onAddItem={onAddChecklistItem}
              onToggleItem={onToggleChecklistItem}
              onUpdateItem={onUpdateChecklistItem}
              onRemoveItem={onRemoveChecklistItem}
            />
          </Section>
        </div>

        <footer className="px-5 py-3 bg-gray-50 border-t border-stroke flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onArchive}
              className="text-sm text-muted hover:text-ink hover:bg-gray-100 px-3 py-1.5 rounded-md"
              title="Hide the card without losing it. Restore later from the archive."
            >
              Archive
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md"
            >
              Delete
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleDone}
              className={`text-sm px-3 py-1.5 rounded-md font-medium ${
                card.done
                  ? 'bg-white border border-stroke text-ink hover:bg-gray-100'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {card.done ? 'Mark as not done' : '✓ Mark as done'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="text-sm px-3 py-1.5 rounded-md bg-ink text-white font-medium hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-muted mb-2">{label}</h3>
      {children}
    </section>
  );
}
