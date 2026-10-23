import { useEffect } from 'react';
import type { BoardCardWithId, ListWithCards } from '../../collab/useYBoard';

interface ArchiveDrawerProps {
  cards: BoardCardWithId[];
  lists: ListWithCards[];
  onClose: () => void;
  onRestore: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  onPurgeAll: () => void;
}

export function ArchiveDrawer({
  cards,
  lists,
  onClose,
  onRestore,
  onDelete,
  onPurgeAll,
}: ArchiveDrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const listTitleById = new Map(lists.map((l) => [l.id, l.title]));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Archived cards"
      className="fixed inset-0 z-40 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/20" aria-hidden />
      <div className="relative bg-white border-l border-stroke w-full max-w-sm h-full flex flex-col shadow-xl">
        <header className="px-4 py-3 border-b border-stroke flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Archived cards</h2>
            <p className="text-xs text-muted">
              {cards.length === 0
                ? 'Nothing archived yet.'
                : `${cards.length} card${cards.length === 1 ? '' : 's'} hidden from the board.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink p-1"
            aria-label="Close archive"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-auto px-2 py-2 space-y-2">
          {cards.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted">
              Archive a card from its detail view to put it here.
            </p>
          )}
          {cards.map((card) => {
            const homeList = listTitleById.get(card.listId);
            return (
              <div
                key={card.id}
                className="bg-white border border-stroke rounded-md px-3 py-2 hover:border-gray-400 transition-colors"
              >
                <div className="text-sm text-ink leading-snug whitespace-pre-wrap break-words">
                  {card.title || 'Untitled card'}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {homeList ? `from "${homeList}"` : '(original list deleted)'}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRestore(card.id)}
                    className="text-xs px-2 py-0.5 rounded bg-ink text-white hover:bg-gray-800"
                    title={
                      homeList
                        ? `Restore to "${homeList}"`
                        : 'Original list is gone — card will be rescued to the first list.'
                    }
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ok = window.confirm(
                        'Delete this card permanently? This cannot be undone.',
                      );
                      if (ok) onDelete(card.id);
                    }}
                    className="text-xs px-2 py-0.5 rounded text-red-600 hover:bg-red-50"
                  >
                    Delete forever
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {cards.length > 0 && (
          <footer className="px-4 py-3 border-t border-stroke flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  `Permanently delete all ${cards.length} archived cards? This cannot be undone.`,
                );
                if (ok) onPurgeAll();
              }}
              className="text-xs text-red-600 hover:bg-red-50 px-2.5 py-1 rounded"
            >
              Delete all archived
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
