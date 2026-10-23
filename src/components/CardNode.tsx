import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { CardData } from '../types';
import { autoTextColor } from '../utils/contrast';
import { useOtherSelectorsFor } from '../collab/OthersContext';

interface CardNodeProps extends NodeProps<CardData> {}

function CardNodeImpl({ id, data, selected }: CardNodeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(data.label);
  }, [data.label, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      el.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== data.label) {
      window.dispatchEvent(
        new CustomEvent('card:label-change', { detail: { id, label: next || 'Untitled' } }),
      );
    }
  };

  const cancel = () => {
    setEditing(false);
    setDraft(data.label);
  };

  const handleDouble = () => setEditing(true);

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('card:context', {
        detail: { id, x: e.clientX, y: e.clientY },
      }),
    );
  };

  const textColor = data.textColorAuto ? autoTextColor(data.bgColor) : data.textColor;
  const otherSelectors = useOtherSelectorsFor(id);
  const remoteColor = otherSelectors[0];

  const style: React.CSSProperties = { background: data.bgColor, color: textColor };
  if (remoteColor && !selected) {
    style.boxShadow = `0 0 0 2px ${remoteColor}`;
  }

  return (
    <div
      className={`card-node card-node--border-${data.borderStyle}`}
      style={style}
      onDoubleClick={handleDouble}
      onContextMenu={handleContext}
      data-selected={selected ? 'true' : 'false'}
    >
      <Handle type="source" position={Position.Top} id="top" isConnectable />
      <Handle type="source" position={Position.Left} id="left" isConnectable />
      {editing ? (
        <textarea
          ref={inputRef}
          className="card-node__input"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
            e.stopPropagation();
          }}
        />
      ) : (
        <span>{data.label}</span>
      )}
      <Handle type="source" position={Position.Right} id="right" isConnectable />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable />
    </div>
  );
}

export const CardNode = memo(CardNodeImpl);
