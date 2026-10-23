import { useEffect, useState } from 'react';
import { autoTextColor } from '../../utils/contrast';

export const LABEL_PALETTE: string[] = [
  '#22c55e', // green
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#a855f7', // purple
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#6b7280', // gray
];

interface LabelPickerProps {
  selected: string[];
  labelNames: Record<string, string>;
  onToggle: (color: string) => void;
  onRenameLabel: (color: string, name: string) => void;
  /** The board-wide color the ★ quick-flag button toggles. */
  quickFlagColor: string;
  /** Set a new color as the quick-flag for everyone in the room. */
  onSetQuickFlagColor: (color: string) => void;
  /** Dedicated single-key shortcut for the flag (independent of palette 1-9). */
  flagKeybind: string | null;
  /** Set the dedicated flag keybind (pass empty to clear). */
  onSetFlagKeybind: (key: string | null) => void;
  /** Color that tints a done card. */
  doneColor: string;
  /** Change which color tints done cards. */
  onSetDoneColor: (color: string) => void;
  /** Dedicated single-key shortcut for toggling done. */
  doneKeybind: string | null;
  /** Set the dedicated done keybind (pass empty to clear). */
  onSetDoneKeybind: (key: string | null) => void;
}

export function LabelPicker({
  selected,
  labelNames,
  onToggle,
  onRenameLabel,
  quickFlagColor,
  onSetQuickFlagColor,
  flagKeybind,
  onSetFlagKeybind,
  doneColor,
  onSetDoneColor,
  doneKeybind,
  onSetDoneKeybind,
}: LabelPickerProps) {
  const quickFlagIdx = LABEL_PALETTE.findIndex(
    (c) => c.toLowerCase() === quickFlagColor.toLowerCase(),
  );
  const doneIdx = LABEL_PALETTE.findIndex(
    (c) => c.toLowerCase() === doneColor.toLowerCase(),
  );
  const impliedFlagKey = quickFlagIdx >= 0 ? String(quickFlagIdx + 1) : '';
  const impliedDoneKey = doneIdx >= 0 ? String(doneIdx + 1) : '';
  const effectiveFlagKey = flagKeybind ?? impliedFlagKey;
  const effectiveDoneKey = doneKeybind ?? impliedDoneKey;
  return (
    <div>
      <ul className="space-y-1">
        {LABEL_PALETTE.map((color, i) => (
          <LabelRow
            key={color}
            color={color}
            shortcut={i + 1}
            name={labelNames[color] ?? ''}
            checked={selected.includes(color)}
            isQuickFlag={color.toLowerCase() === quickFlagColor.toLowerCase()}
            isDoneColor={color.toLowerCase() === doneColor.toLowerCase()}
            onToggle={() => onToggle(color)}
            onSetQuickFlag={() => onSetQuickFlagColor(color)}
            onSetDoneColor={() => onSetDoneColor(color)}
            onRename={(name) => onRenameLabel(color, name)}
          />
        ))}
      </ul>
      <div className="mt-3 pt-2 border-t border-stroke space-y-1.5">
        <label className="flex items-center gap-2 text-xs">
          <span className="text-amber-500 font-bold w-4 text-center" aria-hidden>
            ★
          </span>
          <span className="text-muted whitespace-nowrap flex-1">Flag keybind:</span>
          <input
            type="text"
            value={flagKeybind ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim().toLowerCase().slice(-1);
              onSetFlagKeybind(v || null);
            }}
            placeholder={impliedFlagKey || '—'}
            maxLength={1}
            aria-label="Flag keybind"
            className="w-8 text-center font-mono border border-stroke rounded px-1 py-0.5"
          />
          {flagKeybind && (
            <button
              type="button"
              onClick={() => onSetFlagKeybind(null)}
              className="text-[11px] text-muted hover:text-ink"
              title="Clear — fall back to palette number for the current flag color"
            >
              reset
            </button>
          )}
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-emerald-600 font-bold w-4 text-center" aria-hidden>
            ✓
          </span>
          <span className="text-muted whitespace-nowrap flex-1">Done keybind:</span>
          <input
            type="text"
            value={doneKeybind ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim().toLowerCase().slice(-1);
              onSetDoneKeybind(v || null);
            }}
            placeholder={impliedDoneKey || '—'}
            maxLength={1}
            aria-label="Done keybind"
            className="w-8 text-center font-mono border border-stroke rounded px-1 py-0.5"
          />
          {doneKeybind && (
            <button
              type="button"
              onClick={() => onSetDoneKeybind(null)}
              className="text-[11px] text-muted hover:text-ink"
              title="Clear — fall back to palette number for the current done color"
            >
              reset
            </button>
          )}
        </label>
        <p className="pt-1 text-[11px] text-muted">
          Hover a card and press{' '}
          <kbd className="px-1 py-0.5 font-mono rounded border border-stroke bg-gray-50">
            {effectiveFlagKey || '?'}
          </kbd>{' '}
          for flag, or{' '}
          <kbd className="px-1 py-0.5 font-mono rounded border border-stroke bg-gray-50">
            {effectiveDoneKey || '?'}
          </kbd>{' '}
          for done. Click the ★ or ✓ on any row above to change which label color each uses.
          Palette{' '}
          <kbd className="px-1 py-0.5 font-mono rounded border border-stroke bg-gray-50">1</kbd>–
          <kbd className="px-1 py-0.5 font-mono rounded border border-stroke bg-gray-50">9</kbd>{' '}
          still toggles labels directly.
        </p>
      </div>
    </div>
  );
}

function LabelRow({
  color,
  shortcut,
  name,
  checked,
  isQuickFlag,
  isDoneColor,
  onToggle,
  onSetQuickFlag,
  onSetDoneColor,
  onRename,
}: {
  color: string;
  shortcut: number;
  name: string;
  checked: boolean;
  isQuickFlag: boolean;
  isDoneColor: boolean;
  onToggle: () => void;
  onSetQuickFlag: () => void;
  onSetDoneColor: () => void;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(name);
  }, [name, dirty]);

  const commit = () => {
    if (!dirty) return;
    setDirty(false);
    if (draft === name) return;
    onRename(draft);
  };

  const textColor = autoTextColor(color);

  return (
    <li>
      <div className="flex items-center gap-2 group">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetQuickFlag();
          }}
          title={
            isQuickFlag
              ? 'This is the current quick-flag color (★ button uses this)'
              : 'Set as the quick-flag color (★ button on every card will use this)'
          }
          aria-pressed={isQuickFlag}
          aria-label="Set as quick-flag color"
          className={`text-sm w-5 text-center ${
            isQuickFlag
              ? 'text-amber-500'
              : 'text-muted opacity-0 group-hover:opacity-100 hover:text-amber-400'
          }`}
        >
          {isQuickFlag ? '★' : '☆'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetDoneColor();
          }}
          title={
            isDoneColor
              ? 'This color tints cards when they are marked done'
              : 'Set this color as the done tint (used when a card is marked done)'
          }
          aria-pressed={isDoneColor}
          aria-label="Set as done color"
          className={`text-sm w-5 text-center font-bold ${
            isDoneColor
              ? 'text-emerald-600'
              : 'text-muted opacity-0 group-hover:opacity-100 hover:text-emerald-500'
          }`}
        >
          {isDoneColor ? '✓' : '·'}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={checked}
          aria-label={`${name ? `Label ${name}` : `Label ${color}`} — shortcut ${shortcut}`}
          className={`flex-1 flex items-center gap-2 px-1.5 py-1 rounded transition-colors ${
            checked ? 'bg-gray-100 dark:bg-slate-700' : 'hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          <kbd
            className="font-mono text-[10px] text-muted w-4 text-center"
            title={`Hover a card and press ${shortcut}`}
          >
            {shortcut}
          </kbd>
          <span
            className="inline-flex items-center justify-center h-6 min-w-[3.5rem] px-2 rounded text-[11px] font-medium truncate"
            style={{ background: color, color: textColor }}
          >
            {name || ' '}
          </span>
          <span
            className={`text-xs ${
              checked ? 'text-emerald-600' : 'text-muted opacity-0 group-hover:opacity-100'
            }`}
            aria-hidden
          >
            {checked ? '✓' : '+'}
          </span>
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDirty(true);
            setDraft(e.target.value.slice(0, 32));
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setDirty(false);
              setDraft(name);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Name…"
          maxLength={32}
          aria-label={`Name for ${color} label`}
          className="w-28 text-xs border border-stroke rounded px-1.5 py-1 bg-white"
        />
      </div>
    </li>
  );
}

interface LabelChipProps {
  color: string;
  name?: string;
  compact?: boolean;
}

export function LabelChip({ color, name, compact = false }: LabelChipProps) {
  if (name) {
    const textColor = autoTextColor(color);
    return (
      <span
        className={`inline-flex items-center rounded font-medium ${
          compact ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'
        }`}
        style={{ background: color, color: textColor }}
        title={name}
      >
        <span className="truncate max-w-[10rem]">{name}</span>
      </span>
    );
  }
  return (
    <span
      className={compact ? 'h-1.5 w-6 rounded-full' : 'h-2 w-8 rounded-full'}
      style={{ background: color }}
      role="img"
      aria-label={`${color} label`}
    />
  );
}
