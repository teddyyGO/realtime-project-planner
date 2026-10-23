import { useEffect, useRef, useState } from 'react';

interface AddListInlineProps {
  onAdd: (title: string) => void;
}

export function AddListInline({ onAdd }: AddListInlineProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setOpen(false);
      setTitle('');
      return;
    }
    onAdd(trimmed);
    setTitle('');
    // Stay open so the user can add several lists in a row.
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 w-72 text-left text-sm px-3 py-2 rounded-lg bg-white/70 border border-dashed border-stroke text-muted hover:text-ink hover:bg-white transition-colors"
      >
        + Add another list
      </button>
    );
  }

  return (
    <div className="shrink-0 w-72 bg-white border border-stroke rounded-lg p-2 shadow-card">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 64))}
        placeholder="List title"
        maxLength={64}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            setOpen(false);
            setTitle('');
          }
        }}
        className="w-full text-sm border border-stroke rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          className="text-sm px-3 py-1 rounded bg-ink text-white font-medium hover:bg-gray-800"
        >
          Add list
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle('');
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
