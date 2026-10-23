import { useEffect, useRef, useState } from 'react';
import { isValidHex, normalizeHex } from '../../utils/contrast';

export type BoardBackground =
  | { type: 'color'; value: string }
  | { type: 'image'; value: string };

export const BACKGROUND_COLORS: { name: string; value: string }[] = [
  { name: 'Default', value: '#f3f4f6' },
  { name: 'Sky', value: '#dbeafe' },
  { name: 'Mint', value: '#dcfce7' },
  { name: 'Amber', value: '#fef3c7' },
  { name: 'Blush', value: '#fee2e2' },
  { name: 'Lilac', value: '#ede9fe' },
  { name: 'Ice', value: '#cffafe' },
  { name: 'Slate', value: '#1e293b' },
];

interface BackgroundPickerProps {
  current: BoardBackground | null;
  onChange: (next: BoardBackground | null) => void;
}

export function BackgroundPicker({ current, onChange }: BackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm px-2.5 py-1.5 rounded text-ink hover:bg-gray-100 inline-flex items-center gap-1.5"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Change board background"
      >
        <Swatch value={current} />
        Background
      </button>
      {open && (
        <BackgroundPanel
          current={current}
          onChange={(next) => {
            onChange(next);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function Swatch({ value }: { value: BoardBackground | null }) {
  const style: React.CSSProperties = { background: '#f3f4f6' };
  if (value?.type === 'color') style.background = value.value;
  if (value?.type === 'image') {
    style.backgroundImage = `url(${value.value})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  }
  return (
    <span
      className="inline-block w-4 h-4 rounded border border-stroke"
      style={style}
      aria-hidden
    />
  );
}

interface BackgroundPanelProps {
  current: BoardBackground | null;
  onChange: (next: BoardBackground | null) => void;
  onClose: () => void;
}

function BackgroundPanel({ current, onChange, onClose }: BackgroundPanelProps) {
  const [customHex, setCustomHex] = useState(
    current?.type === 'color' ? current.value : '#ffffff',
  );
  const [imageUrl, setImageUrl] = useState(current?.type === 'image' ? current.value : '');
  const [imageError, setImageError] = useState<string | null>(null);

  const commitHex = (value: string) => {
    if (!isValidHex(value)) return;
    onChange({ type: 'color', value: normalizeHex(value) });
  };

  const commitImage = () => {
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      setImageError('Paste an image URL above');
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setImageError('URL must start with http:// or https://');
      return;
    }
    setImageError(null);
    onChange({ type: 'image', value: trimmed });
  };

  return (
    <div
      role="dialog"
      aria-label="Background"
      className="absolute right-0 top-full mt-1 z-30 w-72 bg-white border border-stroke rounded-lg shadow-card p-3"
    >
      <Section label="Color">
        <div className="grid grid-cols-8 gap-1.5">
          {BACKGROUND_COLORS.map((c) => {
            const active = current?.type === 'color' && current.value.toLowerCase() === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onChange({ type: 'color', value: c.value })}
                title={c.name}
                aria-label={c.name}
                aria-pressed={active}
                className={`h-7 w-7 rounded border ${
                  active ? 'ring-2 ring-blue-500 border-transparent' : 'border-stroke'
                }`}
                style={{ background: c.value }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={isValidHex(customHex) ? normalizeHex(customHex) : '#ffffff'}
            onChange={(e) => {
              setCustomHex(e.target.value);
              commitHex(e.target.value);
            }}
            className="w-9 h-8 border border-stroke rounded cursor-pointer"
            aria-label="Custom color"
          />
          <input
            type="text"
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            onBlur={() => commitHex(customHex)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitHex(customHex);
              }
            }}
            placeholder="#ffffff"
            className="flex-1 text-sm border border-stroke rounded px-2 py-1 font-mono"
          />
        </div>
      </Section>

      <Section label="Image URL">
        <div className="space-y-1.5">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setImageError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitImage();
              }
            }}
            placeholder="https://images.example.com/photo.jpg"
            className="w-full text-sm border border-stroke rounded px-2 py-1.5"
          />
          {imageError && <p className="text-xs text-red-600">{imageError}</p>}
          <button
            type="button"
            onClick={commitImage}
            className="text-sm px-2.5 py-1 rounded bg-ink text-white hover:bg-gray-800"
          >
            Apply image
          </button>
          <p className="text-[11px] text-muted">
            Paste a link to any web image. Hotlinked from your URL — nothing is uploaded.
          </p>
        </div>
      </Section>

      <div className="mt-3 pt-2 border-t border-stroke flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-sm text-muted hover:text-ink"
        >
          Reset to default
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-2.5 py-1 rounded hover:bg-gray-100"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 last:mb-0">
      <h4 className="text-[11px] uppercase tracking-wide text-muted mb-1.5">{label}</h4>
      {children}
    </section>
  );
}
