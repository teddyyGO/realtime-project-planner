import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ToolbarProps {
  onAddCard: () => void;
  onAutoLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onImportFile: (file: File) => void;
  onExportJson: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onNewRoom: () => void;
  onCopyShareLink: () => void;
  shareLinkCopied: boolean;
  presence: ReactNode;
  syncStatus: ReactNode;
}

export function Toolbar(props: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const triggerImport = () => fileRef.current?.click();

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 backdrop-blur border border-stroke rounded-lg shadow-card px-1.5 py-1.5">
      <ToolbarButton onClick={props.onAddCard} label="+ Add card" primary />
      <Divider />
      <ToolbarButton onClick={props.onAutoLayout} label="Auto-layout" />
      <Divider />
      <ToolbarButton onClick={props.onUndo} label="Undo" disabled={!props.canUndo} title="Cmd/Ctrl+Z" />
      <ToolbarButton onClick={props.onRedo} label="Redo" disabled={!props.canRedo} title="Cmd/Ctrl+Shift+Z" />
      <Divider />
      <ToolbarButton onClick={triggerImport} label="Import" />
      <div className="relative">
        <ToolbarButton
          onClick={() => setExportOpen((v) => !v)}
          label="Export ▾"
          aria-haspopup="menu"
          aria-expanded={exportOpen}
        />
        {exportOpen && (
          <div
            className="absolute right-0 mt-1 w-36 bg-white border border-stroke rounded-md shadow-card text-sm overflow-hidden"
            role="menu"
            onMouseLeave={() => setExportOpen(false)}
          >
            <MenuItem onClick={() => { props.onExportJson(); setExportOpen(false); }} label="JSON" />
            <MenuItem onClick={() => { props.onExportSvg(); setExportOpen(false); }} label="SVG" />
            <MenuItem onClick={() => { props.onExportPng(); setExportOpen(false); }} label="PNG" />
          </div>
        )}
      </div>
      <Divider />
      <ToolbarButton onClick={props.onNewRoom} label="New room" />
      <ToolbarButton
        onClick={props.onCopyShareLink}
        label={props.shareLinkCopied ? 'Copied ✓' : 'Share'}
      />
      <Divider />
      <div className="px-1">{props.presence}</div>
      {props.syncStatus}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) props.onImportFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  disabled,
  primary,
  title,
  'aria-haspopup': ariaHaspopup,
  'aria-expanded': ariaExpanded,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
  'aria-haspopup'?: 'menu' | 'true';
  'aria-expanded'?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-haspopup={ariaHaspopup}
      aria-expanded={ariaExpanded}
      className={`text-sm px-2.5 py-1.5 rounded transition-colors ${
        disabled
          ? 'text-muted cursor-not-allowed'
          : primary
            ? 'text-ink hover:bg-gray-100 font-medium'
            : 'text-ink hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-stroke mx-0.5" aria-hidden />;
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full text-left px-3 py-1.5 hover:bg-gray-100"
    >
      {label}
    </button>
  );
}
