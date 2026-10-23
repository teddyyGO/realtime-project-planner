import { useEffect, useState } from 'react';
import type { BorderStyle, CardNode } from '../types';
import { PRESET_SWATCHES } from '../types';
import { autoTextColor, isValidHex, normalizeHex } from '../utils/contrast';

interface StylePanelProps {
  node: CardNode | null;
  onChangeBg: (id: string, hex: string) => void;
  onChangeTextColor: (id: string, hex: string, auto: boolean) => void;
  onChangeBorder: (id: string, style: BorderStyle) => void;
  onDelete: (id: string) => void;
}

export function StylePanel({ node, onChangeBg, onChangeTextColor, onChangeBorder, onDelete }: StylePanelProps) {
  const [hexInput, setHexInput] = useState('');
  const [textHexInput, setTextHexInput] = useState('');

  useEffect(() => {
    setHexInput(node?.data.bgColor ?? '');
    setTextHexInput(node?.data.textColor ?? '');
  }, [node?.id, node?.data.bgColor, node?.data.textColor]);

  if (!node) return null;

  const handleHexCommit = () => {
    if (isValidHex(hexInput)) {
      onChangeBg(node.id, normalizeHex(hexInput));
    } else {
      setHexInput(node.data.bgColor);
    }
  };

  const handleTextHexCommit = () => {
    if (isValidHex(textHexInput)) {
      onChangeTextColor(node.id, normalizeHex(textHexInput), false);
    } else {
      setTextHexInput(node.data.textColor);
    }
  };

  const effectiveTextColor = node.data.textColorAuto
    ? autoTextColor(node.data.bgColor)
    : node.data.textColor;

  return (
    <aside className="absolute top-0 right-0 h-full w-72 bg-white border-l border-stroke z-10 flex flex-col">
      <header className="px-4 py-3 border-b border-stroke flex items-center justify-between">
        <div>
          <div className="text-xs text-muted uppercase tracking-wide">Selected card</div>
          <div className="text-sm font-medium truncate" title={node.data.label}>
            {node.data.label || 'Untitled'}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-6">
        <Section title="Background">
          <div className="grid grid-cols-7 gap-2">
            {PRESET_SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                title={s.name}
                aria-label={s.name}
                onClick={() => onChangeBg(node.id, s.value)}
                className={`w-7 h-7 rounded border ${
                  node.data.bgColor.toLowerCase() === s.value.toLowerCase()
                    ? 'ring-2 ring-blue-500 border-transparent'
                    : 'border-stroke'
                }`}
                style={{ background: s.value }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="color"
              value={isValidHex(hexInput) ? normalizeHex(hexInput) : '#ffffff'}
              onChange={(e) => {
                setHexInput(e.target.value);
                onChangeBg(node.id, e.target.value);
              }}
              className="w-9 h-8 border border-stroke rounded cursor-pointer"
              aria-label="Custom background color"
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={handleHexCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleHexCommit();
              }}
              placeholder="#ffffff"
              className="flex-1 text-sm border border-stroke rounded px-2 py-1 font-mono"
            />
          </div>
        </Section>

        <Section title="Text color">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={node.data.textColorAuto}
              onChange={(e) =>
                onChangeTextColor(node.id, node.data.textColor, e.target.checked)
              }
            />
            Auto-contrast
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={
                node.data.textColorAuto
                  ? effectiveTextColor
                  : isValidHex(textHexInput)
                    ? normalizeHex(textHexInput)
                    : '#1f2937'
              }
              onChange={(e) => {
                setTextHexInput(e.target.value);
                onChangeTextColor(node.id, e.target.value, false);
              }}
              disabled={node.data.textColorAuto}
              className="w-9 h-8 border border-stroke rounded cursor-pointer disabled:opacity-50"
              aria-label="Custom text color"
            />
            <input
              type="text"
              value={node.data.textColorAuto ? effectiveTextColor : textHexInput}
              onChange={(e) => setTextHexInput(e.target.value)}
              onBlur={handleTextHexCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTextHexCommit();
              }}
              disabled={node.data.textColorAuto}
              placeholder="#1f2937"
              className="flex-1 text-sm border border-stroke rounded px-2 py-1 font-mono disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>
        </Section>

        <Section title="Border">
          <div className="flex gap-1 bg-gray-100 rounded p-1">
            {(['none', 'thin', 'thick'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChangeBorder(node.id, opt)}
                className={`flex-1 text-sm px-3 py-1 rounded capitalize ${
                  node.data.borderStyle === opt ? 'bg-white shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Actions">
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="w-full text-sm py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
          >
            Delete card
          </button>
        </Section>
      </div>

      <footer className="px-4 py-2 text-[11px] text-muted border-t border-stroke">
        Double-click card to edit · Drag handles to connect
      </footer>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-muted mb-2">{title}</h3>
      {children}
    </section>
  );
}
