import { useEffect, useRef, useState } from 'react';

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
}

interface TemplatePickerMenuProps {
  label: string;
  templates: TemplateOption[];
  onPick: (templateId: string) => void;
}

export function TemplatePickerMenu({ label, templates, onPick }: TemplatePickerMenuProps) {
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
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm px-3 py-1.5 rounded-md bg-ink text-white font-medium hover:bg-gray-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label} ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 w-72 bg-white border border-stroke rounded-lg shadow-card overflow-hidden"
        >
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onPick(t.id);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-stroke last:border-b-0"
            >
              <div className="text-sm font-medium text-ink">{t.name}</div>
              <div className="text-xs text-muted mt-0.5">{t.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
