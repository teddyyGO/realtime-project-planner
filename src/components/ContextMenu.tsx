import { useEffect, useRef } from 'react';

export interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

interface ContextMenuProps {
  state: ContextMenuState | null;
  onClose: () => void;
  onAddChild: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
}

export function ContextMenu({ state, onClose, onAddChild, onDelete }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      ref={ref}
      className="fixed z-30 bg-white border border-stroke rounded-md shadow-card text-sm py-1 min-w-[160px]"
      style={{ top: state.y, left: state.x }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-1.5 hover:bg-gray-100"
        onClick={() => {
          onAddChild(state.nodeId);
          onClose();
        }}
      >
        Add child
      </button>
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-red-600"
        onClick={() => {
          onDelete(state.nodeId);
          onClose();
        }}
      >
        Delete card
      </button>
    </div>
  );
}
