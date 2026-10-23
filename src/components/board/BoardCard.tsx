import { memo } from 'react';
import type { BoardCardWithId } from '../../collab/useYBoard';
import { LabelChip } from './LabelPicker';

interface BoardCardProps {
  card: BoardCardWithId;
  onOpen: () => void;
  /** Awareness color of remote user(s) currently viewing this card. */
  remoteColor?: string;
  /** Drag handle props from @dnd-kit, applied to the whole card. */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  /** Toggle the card's done state. If omitted, the done checkbox is hidden. */
  onToggleDone?: () => void;
  /** Toggle the "quick flag" label. If omitted, the flag button is hidden. */
  onToggleQuickFlag?: () => void;
  /** Hex color the ★ flag button currently toggles (configurable per board). */
  flagColor?: string;
  /** Keybind character shown in the ★ tooltip (e.g. "2" or "f"). */
  flagKeybindHint?: string;
  /** Hex color used to tint the card when it is marked done. */
  doneColor?: string;
  /** Keybind character shown in the ✓ tooltip. */
  doneKeybindHint?: string;
  /** Board-level color → name map (Trello-style). Names render as text in the chip. */
  labelNames?: Record<string, string>;
}

export const BoardCard = memo(function BoardCard({
  card,
  onOpen,
  remoteColor,
  dragHandleProps,
  isDragging,
  onToggleDone,
  onToggleQuickFlag,
  flagColor = '#eab308',
  flagKeybindHint,
  doneColor = '#22c55e',
  doneKeybindHint,
  labelNames,
}: BoardCardProps) {
  const labels = card.labels ?? [];
  // Count across both new (groups) and legacy (flat) shape.
  const groupItems = (card.checklists ?? []).flatMap((g) => g.items);
  const flatItems = card.checklist ?? [];
  const checklist = groupItems.length > 0 ? groupItems : flatItems;
  const checklistTotal = checklist.length;
  const checklistDone = checklist.filter((c) => c.done).length;
  const due = card.dueDate ? parseLocalDate(card.dueDate) : null;
  const isOverdue = due ? due.getTime() < startOfToday() : false;
  const done = !!card.done;
  const flagged = (card.labels ?? []).includes(flagColor);
  const flagLabelName = labelNames?.[flagColor];

  const style: React.CSSProperties = {};
  if (remoteColor) style.boxShadow = `0 0 0 2px ${remoteColor}`;
  if (isDragging) style.opacity = 0.5;
  // Done tint takes precedence over flag tint — a done card can still be
  // flagged in the data, but visually "done" wins for card background.
  if (done) {
    style.background = `color-mix(in srgb, ${doneColor} 12%, var(--surface, #ffffff))`;
    style.boxShadow = remoteColor
      ? `inset 3px 0 0 ${doneColor}, 0 0 0 2px ${remoteColor}`
      : `inset 3px 0 0 ${doneColor}`;
  } else if (flagged) {
    style.background = `color-mix(in srgb, ${flagColor} 10%, var(--surface, #ffffff))`;
    style.boxShadow = remoteColor
      ? `inset 3px 0 0 ${flagColor}, 0 0 0 2px ${remoteColor}`
      : `inset 3px 0 0 ${flagColor}`;
  }

  return (
    <div
      {...dragHandleProps}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
        dragHandleProps?.onKeyDown?.(e);
      }}
      role="button"
      tabIndex={0}
      className="group relative block w-full text-left bg-white border border-stroke rounded-md p-2 shadow-card hover:border-gray-400 transition-colors cursor-pointer"
      style={style}
    >
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        {onToggleQuickFlag && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleQuickFlag();
            }}
            aria-pressed={flagged}
            aria-label={flagged ? 'Remove flag' : 'Flag card'}
            title={`${flagged ? 'Remove' : 'Toggle'} ${
              flagLabelName ?? 'flag'
            }${flagKeybindHint ? ` (press ${flagKeybindHint})` : ''}`}
            style={
              flagged ? { background: flagColor, borderColor: flagColor } : undefined
            }
            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] leading-none transition-opacity ${
              flagged
                ? 'text-white opacity-100'
                : 'bg-white border-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:border-gray-500'
            }`}
          >
            <span aria-hidden>★</span>
          </button>
        )}
        {onToggleDone && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleDone();
            }}
            aria-pressed={done}
            aria-label={done ? 'Mark as not done' : 'Mark as done'}
            title={`${done ? 'Mark as not done' : 'Mark as done'}${
              doneKeybindHint ? ` (press ${doneKeybindHint})` : ''
            }`}
            style={done ? { background: doneColor, borderColor: doneColor } : undefined}
            className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] leading-none transition-opacity ${
              done
                ? 'text-white opacity-100'
                : 'bg-white border-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:border-gray-500'
            }`}
          >
            {done ? '✓' : ''}
          </button>
        )}
      </div>
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5 pr-10">
          {labels.map((c) => (
            <LabelChip key={c} color={c} name={labelNames?.[c]} />
          ))}
        </div>
      )}
      <div
        className={`text-sm leading-snug whitespace-pre-wrap break-words pr-10 ${
          done ? 'text-muted line-through' : 'text-ink'
        }`}
      >
        {card.title || 'Untitled card'}
      </div>
      {(due || checklistTotal > 0 || (card.description && card.description.trim())) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          {card.description?.trim() && (
            <span title="Has description" aria-label="Has description">
              ≡
            </span>
          )}
          {checklistTotal > 0 && (
            <span className={checklistDone === checklistTotal ? 'text-emerald-600' : ''}>
              ☐ {checklistDone}/{checklistTotal}
            </span>
          )}
          {due && (
            <span
              className={`px-1.5 py-0.5 rounded ${
                isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-muted'
              }`}
              title={due.toDateString()}
            >
              {formatDueDate(due)}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Parse an ISO date string ("2026-06-20") as a date at LOCAL midnight, not
 * UTC midnight. `new Date('2026-06-20')` returns UTC midnight, which appears
 * as the previous day in negative-offset locales — that would flag cards as
 * overdue a day early.
 */
function parseLocalDate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d, 0, 0, 0, 0);
}

function formatDueDate(d: Date): string {
  const m = d.toLocaleString(undefined, { month: 'short' });
  return `${m} ${d.getDate()}`;
}
