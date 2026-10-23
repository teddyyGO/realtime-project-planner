import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadRecents, relativeTime, removeRecent, type RecentProject } from '../utils/recents';
import type { UserIdentity } from '../utils/userIdentity';
import { makeRoomName } from '../collab/yRoom';
import { BOARD_TEMPLATES } from '../utils/templates';
import { SectionSwitcher } from './SectionSwitcher';
import { TemplatePickerMenu } from './TemplatePickerMenu';
import { ThemeToggle } from './ThemeToggle';

interface ServerMeta {
  name: string;
  title: string | null;
  updatedAt: string;
}

interface BoardDashboardProps {
  identity: UserIdentity;
  onEditIdentity: () => void;
  onOpenBoard: (slug: string) => void;
  onCreateBoard: (templateId?: string) => void;
  onHome: () => void;
  onSwitchToTrees: () => void;
}

export function BoardDashboard({
  identity,
  onEditIdentity,
  onOpenBoard,
  onCreateBoard,
  onHome,
  onSwitchToTrees,
}: BoardDashboardProps) {
  const [recents, setRecents] = useState<RecentProject[]>(() => loadRecents('board'));
  const [serverMeta, setServerMeta] = useState<Map<string, ServerMeta>>(new Map());
  const [serverFetchFailed, setServerFetchFailed] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (recents.length === 0) return;
    // Board document names are prefixed on the server.
    const roomNames = recents.map((r) => makeRoomName('board', r.slug));
    const ctrl = new AbortController();
    fetch(`/api/rooms?slugs=${encodeURIComponent(roomNames.join(','))}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows: { slug: string; title: string | null; updatedAt: string }[]) => {
        const m = new Map<string, ServerMeta>();
        for (const row of rows) {
          // Strip the "board-" prefix to match the user-facing slug.
          const baseSlug = row.slug.startsWith('board-') ? row.slug.slice(6) : row.slug;
          m.set(baseSlug, { name: row.slug, title: row.title, updatedAt: row.updatedAt });
        }
        setServerMeta(m);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setServerFetchFailed(true);
      });
    return () => ctrl.abort();
  }, [recents.length]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const [search, setSearch] = useState('');
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recents
      .map((r) => {
        const meta = serverMeta.get(r.slug);
        const title = meta?.title?.trim() || r.title || 'Untitled board';
        const updatedAtMs = meta?.updatedAt ? new Date(meta.updatedAt).getTime() : r.lastOpenedAt;
        const updatedLabel = meta?.updatedAt
          ? `Updated ${relativeTime(updatedAtMs)}`
          : `Opened ${relativeTime(r.lastOpenedAt)}`;
        return {
          slug: r.slug,
          title,
          updatedAtMs,
          updatedLabel,
          hasServerMeta: !!meta,
        };
      })
      .filter((p) => {
        if (!q) return true;
        return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
      })
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [recents, serverMeta, search]);

  const handleRemove = useCallback((slug: string) => {
    removeRecent('board', slug);
    setRecents(loadRecents('board'));
  }, []);

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gray-50">
      <header className="border-b border-stroke bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-base font-semibold text-ink leading-tight">Boards</h1>
              <p className="text-xs text-muted">Kanban-style cards moving across columns</p>
            </div>
            <div className="ml-3 pl-3 border-l border-stroke">
              <SectionSwitcher
                active="boards"
                onTrees={onSwitchToTrees}
                onBoards={() => {}}
                onHome={onHome}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={onEditIdentity}
              className="flex items-center gap-2 text-sm px-2 py-1 rounded-md hover:bg-gray-100"
              aria-label="Edit your nickname"
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold text-white"
                style={{ background: identity.color }}
              >
                {identity.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-ink">{identity.name}</span>
              <span className="text-xs text-muted">Edit</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-sm font-medium text-muted uppercase tracking-wide flex-shrink-0">
              Your boards
            </h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search boards…"
              className="flex-1 max-w-xs text-sm border border-stroke rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search boards"
            />
            <TemplatePickerMenu
              label="+ New board"
              templates={BOARD_TEMPLATES}
              onPick={(id) => onCreateBoard(id)}
            />
          </div>
          {search && items.length === 0 && recents.length > 0 && (
            <p className="mb-3 text-sm text-muted">
              No boards match "{search}".{' '}
              <button
                type="button"
                onClick={() => setSearch('')}
                className="underline hover:text-ink"
              >
                Clear
              </button>
            </p>
          )}

          {items.length === 0 && !search ? (
            <EmptyState onCreate={onCreateBoard} />
          ) : items.length === 0 ? null : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((p) => (
                <li key={p.slug}>
                  <BoardCardThumb
                    title={p.title}
                    updatedLabel={p.updatedLabel}
                    slug={p.slug}
                    onOpen={() => onOpenBoard(p.slug)}
                    onRemove={() => handleRemove(p.slug)}
                    serverKnown={p.hasServerMeta}
                  />
                </li>
              ))}
            </ul>
          )}

          {serverFetchFailed && (
            <p className="mt-4 text-xs text-muted">
              Couldn't reach the server for fresh updates — showing your local cache.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function BoardCardThumb({
  title,
  updatedLabel,
  slug,
  onOpen,
  onRemove,
  serverKnown,
}: {
  title: string;
  updatedLabel: string;
  slug: string;
  onOpen: () => void;
  onRemove: () => void;
  serverKnown: boolean;
}) {
  return (
    <div className="group relative bg-white border border-stroke rounded-lg hover:border-gray-400 transition-colors">
      <button type="button" onClick={onOpen} className="w-full text-left px-4 py-3.5">
        <div className="font-medium text-ink truncate" title={title}>
          {title}
        </div>
        <div className="mt-0.5 text-xs text-muted">{updatedLabel}</div>
        <div className="mt-1 text-[10px] font-mono text-muted/70 truncate" title={slug}>
          {slug}
          {!serverKnown && <span className="ml-1.5 text-amber-600">· local only</span>}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 text-xs text-muted px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100"
        title="Remove from this list (doesn't delete the board)"
        aria-label="Remove from list"
      >
        Remove
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: (templateId?: string) => void }) {
  return (
    <div className="border border-dashed border-stroke rounded-xl bg-white py-16 text-center">
      <Logo size={28} />
      <h3 className="mt-4 text-base font-semibold text-ink">No boards yet</h3>
      <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
        Start a new kanban board to track work across To do / Doing / Done. Share the URL
        with teammates to edit it together in real time.
      </p>
      <button
        type="button"
        onClick={() => onCreate()}
        className="mt-5 text-sm px-3.5 py-1.5 rounded-md bg-ink text-white font-medium hover:bg-gray-800"
      >
        Create your first board
      </button>
    </div>
  );
}

function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill="#1f2937" />
      <g fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
        <rect x="6" y="8" width="6" height="16" rx="1" />
        <rect x="14" y="8" width="6" height="12" rx="1" />
        <rect x="22" y="8" width="6" height="8" rx="1" />
      </g>
    </svg>
  );
}
