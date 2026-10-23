import { useEffect, useMemo, useState } from 'react';
import type { ImportedBoardCard } from '../../utils/boardImport';
import type { ListWithCards } from '../../collab/useYBoard';

export type ImportMode =
  | { kind: 'existing'; listId: string }
  | { kind: 'new'; listName: string }
  | { kind: 'preserve' };

interface ImportCardsDialogProps {
  cards: ImportedBoardCard[];
  hasListAssignments: boolean;
  listNames: string[];
  lists: ListWithCards[];
  onCancel: () => void;
  onConfirm: (mode: ImportMode) => void;
}

export function ImportCardsDialog({
  cards,
  hasListAssignments,
  listNames,
  lists,
  onCancel,
  onConfirm,
}: ImportCardsDialogProps) {
  // Default mode: preserve if the JSON has list assignments, else "existing".
  const [mode, setMode] = useState<ImportMode['kind']>(
    hasListAssignments ? 'preserve' : lists.length === 0 ? 'new' : 'existing',
  );
  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id ?? '');
  const [newListName, setNewListName] = useState('Imported');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const cardCountsByList = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) {
      const key = (c.list ?? 'Imported').trim();
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [cards]);

  const canConfirm =
    cards.length > 0 &&
    ((mode === 'existing' && selectedListId) ||
      (mode === 'new' && newListName.trim()) ||
      mode === 'preserve');

  const submit = () => {
    if (!canConfirm) return;
    if (mode === 'preserve') onConfirm({ kind: 'preserve' });
    else if (mode === 'existing') onConfirm({ kind: 'existing', listId: selectedListId });
    else onConfirm({ kind: 'new', listName: newListName.trim().slice(0, 64) });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md bg-white border border-stroke rounded-xl shadow-lg overflow-hidden">
        <header className="px-5 pt-4 pb-3 border-b border-stroke">
          <h2 id="import-dialog-title" className="text-base font-semibold text-ink">
            Import {cards.length} card{cards.length === 1 ? '' : 's'}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {hasListAssignments
              ? 'The JSON has list assignments — pick how to apply them.'
              : 'Pick which list these cards should go into.'}
          </p>
        </header>

        <div className="px-5 py-4 space-y-3">
          {hasListAssignments && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                checked={mode === 'preserve'}
                onChange={() => setMode('preserve')}
                className="mt-1"
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-ink block">
                  Use list assignments from JSON ({listNames.length} list
                  {listNames.length === 1 ? '' : 's'})
                </span>
                <span className="text-xs text-muted block mt-0.5">
                  Existing columns with matching titles are reused; missing ones are created.
                </span>
                <ul className="mt-1.5 text-xs text-muted space-y-0.5 max-h-28 overflow-auto">
                  {listNames.map((name) => (
                    <li key={name}>
                      <span className="text-ink/80">{name}</span>{' '}
                      <span className="text-muted">— {cardCountsByList.get(name) ?? 0} card(s)</span>
                    </li>
                  ))}
                </ul>
              </span>
            </label>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              checked={mode === 'existing'}
              onChange={() => setMode('existing')}
              disabled={lists.length === 0}
              className="mt-1"
            />
            <span className="flex-1">
              <span className="text-sm font-medium text-ink block">
                {hasListAssignments ? 'Flatten all into existing list' : 'Existing list'}
              </span>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                onFocus={() => setMode('existing')}
                disabled={mode !== 'existing'}
                className="mt-1.5 w-full text-sm border border-stroke rounded px-2 py-1.5 disabled:opacity-50"
              >
                {lists.length === 0 && <option value="">(no lists exist yet)</option>}
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} ({l.cards.length} cards)
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
              className="mt-1"
            />
            <span className="flex-1">
              <span className="text-sm font-medium text-ink block">
                {hasListAssignments ? 'Flatten all into new list' : 'New list'}
              </span>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value.slice(0, 64))}
                onFocus={() => setMode('new')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirm) {
                    e.preventDefault();
                    submit();
                  }
                }}
                disabled={mode !== 'new'}
                placeholder="List name"
                className="mt-1.5 w-full text-sm border border-stroke rounded px-2 py-1.5 disabled:opacity-50"
              />
            </span>
          </label>

          <details className="text-xs text-muted">
            <summary className="cursor-pointer hover:text-ink">Preview card titles</summary>
            <ul className="mt-2 pl-4 list-disc space-y-0.5 max-h-40 overflow-auto">
              {cards.map((c, i) => (
                <li key={i} className="text-ink/80">
                  {c.title}
                  {c.list && <span className="text-muted ml-1">→ {c.list}</span>}
                </li>
              ))}
            </ul>
          </details>
        </div>

        <footer className="px-5 py-3 bg-gray-50 border-t border-stroke flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm px-3 py-1.5 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canConfirm}
            className="text-sm px-3 py-1.5 rounded-md bg-ink text-white font-medium disabled:opacity-40"
          >
            Import
          </button>
        </footer>
      </div>
    </div>
  );
}
