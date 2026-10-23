import { useEffect, useState } from 'react';

const SHORTCUTS: { section: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    section: 'Anywhere',
    rows: [
      { keys: ['?'], label: 'Open this shortcuts overlay' },
      { keys: ['Esc'], label: 'Close any open dialog or menu' },
      { keys: ['Cmd / Ctrl', 'Z'], label: 'Undo your last change' },
      { keys: ['Cmd / Ctrl', 'Shift', 'Z'], label: 'Redo' },
    ],
  },
  {
    section: 'Tree Maker',
    rows: [
      { keys: ['Double-click card'], label: 'Edit card label inline' },
      { keys: ['Right-click card'], label: 'Add child / delete from context menu' },
      { keys: ['Drag handle'], label: 'Connect cards (any side to any side)' },
      { keys: ['Double-click edge'], label: 'Add or change an edge label' },
      { keys: ['Delete / Backspace'], label: 'Remove the selected card or edge' },
    ],
  },
  {
    section: 'Boards',
    rows: [
      { keys: ['Click card'], label: 'Open card detail modal' },
      { keys: ['Drag card'], label: 'Reorder within a list or move between lists' },
      { keys: ['Drag list header'], label: 'Reorder columns' },
      { keys: ['✓ in card corner'], label: 'Mark card as done / not done' },
      { keys: ['★ in card corner'], label: 'Quick-flag (color and keybind set per-board in the Labels picker)' },
      { keys: ['Hover card', '1'], label: 'Toggle green label' },
      { keys: ['Hover card', '2'], label: 'Toggle yellow label' },
      { keys: ['Hover card', '3'], label: 'Toggle orange label' },
      { keys: ['Hover card', '4'], label: 'Toggle red label' },
      { keys: ['Hover card', '5'], label: 'Toggle purple label' },
      { keys: ['Hover card', '6'], label: 'Toggle blue label' },
      { keys: ['Hover card', '7'], label: 'Toggle cyan label' },
      { keys: ['Hover card', '8'], label: 'Toggle pink label' },
      { keys: ['Hover card', '9'], label: 'Toggle gray label' },
      { keys: ['Space / Enter on card'], label: 'Grab for keyboard drag (then arrows + Space)' },
    ],
  },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function ShortcutsOverlayMount() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // "?" — works without modifier; on US layouts it's Shift+/, on others it
      // can come in as just key="?". Either way skip when typing in inputs.
      if (e.key === '?' && !isEditableTarget(e.target)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-white border border-stroke rounded-xl shadow-lg">
        <header className="px-5 pt-4 pb-3 border-b border-stroke flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-muted hover:text-ink p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4 space-y-5">
          {SHORTCUTS.map((s) => (
            <section key={s.section}>
              <h3 className="text-xs uppercase tracking-wide text-muted mb-2">{s.section}</h3>
              <dl className="space-y-1.5">
                {s.rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <dt className="flex items-center gap-1 flex-shrink-0">
                      {r.keys.map((k, j) => (
                        <span key={j} className="contents">
                          {j > 0 && <span className="text-muted text-xs">+</span>}
                          <kbd className="px-1.5 py-0.5 text-[11px] font-mono rounded border border-stroke bg-gray-50 text-ink shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </dt>
                    <dd className="text-ink/80">{r.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <footer className="px-5 py-3 bg-gray-50 border-t border-stroke text-xs text-muted">
          Press <kbd className="px-1 py-0.5 font-mono rounded border border-stroke bg-white">?</kbd>{' '}
          anywhere to toggle this overlay.
        </footer>
      </div>
    </div>
  );
}
