import { useEffect, useRef, useState } from 'react';
import { PRESET_COLORS, randomColor, type UserIdentity } from '../utils/userIdentity';

interface NicknameDialogProps {
  initial: UserIdentity | null;
  onSave: (identity: UserIdentity) => void;
  /** If omitted, dialog is non-dismissible (first-time onboarding). */
  onCancel?: () => void;
}

export function NicknameDialog({ initial, onSave, onCancel }: NicknameDialogProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? randomColor());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= 24;

  const submit = () => {
    if (!canSave) return;
    onSave({ name: trimmed, color, chosen: true });
  };

  const isOnboarding = onCancel === undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nickname-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel();
      }}
    >
      <div className="w-full max-w-sm bg-white border border-stroke rounded-xl shadow-lg overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 id="nickname-dialog-title" className="text-base font-semibold text-ink">
            {isOnboarding ? 'Choose a nickname' : 'Edit your nickname'}
          </h2>
          <p className="text-sm text-muted mt-1">
            This is how teammates see you in real time on the canvas.
          </p>
        </div>

        <div className="px-5 pb-4 space-y-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-muted mb-1.5">
              Nickname
            </span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                } else if (e.key === 'Escape' && onCancel) {
                  e.preventDefault();
                  onCancel();
                }
              }}
              placeholder="e.g. Alex"
              maxLength={24}
              className="w-full text-sm border border-stroke rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs uppercase tracking-wide text-muted">Color</span>
              <button
                type="button"
                onClick={() => setColor(randomColor())}
                className="text-xs text-muted hover:text-ink"
              >
                Randomize
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-105' : ''
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-semibold"
              style={{ background: color }}
            >
              {(trimmed || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="text-sm text-ink truncate">{trimmed || 'Your name'}</span>
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-stroke flex items-center justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm px-3 py-1.5 rounded-md hover:bg-gray-100 text-ink"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={submit}
            className="text-sm px-3 py-1.5 rounded-md bg-ink text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800"
          >
            {isOnboarding ? 'Continue' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
