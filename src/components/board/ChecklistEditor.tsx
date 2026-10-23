import { useEffect, useRef, useState } from 'react';
import type { ChecklistItem } from '../../collab/yRoom';

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, text: string) => void;
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}

export function ChecklistEditor({
  items,
  onToggle,
  onUpdate,
  onAdd,
  onRemove,
}: ChecklistEditorProps) {
  const [draft, setDraft] = useState('');

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  };

  const done = items.filter((i) => i.done).length;
  const total = items.length;

  return (
    <div>
      {total > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted tabular-nums">
            {done}/{total}
          </span>
        </div>
      )}

      <ul className="space-y-1">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            onToggle={() => onToggle(item.id, !item.done)}
            onUpdate={(text) => onUpdate(item.id, text)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitDraft();
            }
          }}
          placeholder="Add an item"
          className="flex-1 text-sm border border-stroke rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={submitDraft}
          disabled={!draft.trim()}
          className="text-sm px-3 py-1.5 rounded bg-ink text-white font-medium disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onUpdate,
  onRemove,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onUpdate: (text: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const dirtyRef = useRef(false);

  // Sync remote text changes into local state when the user isn't typing —
  // otherwise commit() compares local stale state to the new remote value and
  // clobbers it on blur.
  useEffect(() => {
    if (!editing || !dirtyRef.current) setText(item.text);
  }, [item.text, editing]);

  const commit = () => {
    setEditing(false);
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const next = text.trim();
    if (!next) {
      setText(item.text);
      return;
    }
    if (next !== item.text) onUpdate(next);
  };

  return (
    <li className="group flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-50">
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        className="h-4 w-4 cursor-pointer"
        aria-label={`Toggle ${item.text}`}
      />
      {editing ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => {
            dirtyRef.current = true;
            setText(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              dirtyRef.current = false;
              setText(item.text);
              setEditing(false);
            }
          }}
          className="flex-1 text-sm border border-stroke rounded px-1.5 py-0.5"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 text-left text-sm ${
            item.done ? 'line-through text-muted' : 'text-ink'
          }`}
        >
          {item.text}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-red-600 px-1"
        title="Remove item"
        aria-label="Remove item"
      >
        ✕
      </button>
    </li>
  );
}
