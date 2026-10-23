import { useEffect, useRef, useState } from 'react';

interface RoomTitleProps {
  title: string;
  onChange: (next: string) => void;
  onBack: () => void;
  backLabel?: string;
}

export function RoomTitle({ title, onChange, onBack, backLabel = 'Projects' }: RoomTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === title) return;
    onChange(next.slice(0, 64));
  };

  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-white/95 backdrop-blur border border-stroke rounded-lg shadow-card px-1.5 py-1.5">
      <button
        type="button"
        onClick={onBack}
        title={`Back to ${backLabel.toLowerCase()}`}
        aria-label={`Back to ${backLabel.toLowerCase()}`}
        className="text-sm px-2 py-1 rounded hover:bg-gray-100 text-ink"
      >
        ← {backLabel}
      </button>
      <span className="w-px h-5 bg-stroke mx-0.5" aria-hidden />
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 64))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(title);
              setEditing(false);
            }
            e.stopPropagation();
          }}
          maxLength={64}
          className="text-sm font-medium px-2 py-1 border border-stroke rounded outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Rename project"
          className="text-sm font-medium text-ink px-2 py-1 rounded hover:bg-gray-100 truncate max-w-[220px]"
        >
          {title || 'Untitled project'}
        </button>
      )}
    </div>
  );
}
