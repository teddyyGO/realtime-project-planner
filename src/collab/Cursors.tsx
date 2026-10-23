import { useViewport } from 'reactflow';
import type { RemotePresence } from './useAwareness';

interface CursorsProps {
  others: RemotePresence[];
}

export function Cursors({ others }: CursorsProps) {
  const { x, y, zoom } = useViewport();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      {others.map((p) => {
        if (!p.cursor) return null;
        const screenX = p.cursor.x * zoom + x;
        const screenY = p.cursor.y * zoom + y;
        return (
          <div
            key={p.clientId}
            className="absolute"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
              transition: 'transform 60ms linear',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              style={{ display: 'block', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))' }}
            >
              <path
                d="M3 2 L21 11 L13 13 L10 21 Z"
                fill={p.user.color}
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute left-3 top-4 text-[11px] font-medium px-1.5 py-0.5 rounded text-white whitespace-nowrap"
              style={{ background: p.user.color }}
            >
              {p.user.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
