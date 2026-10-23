// Per-browser preference for which lists are collapsed in which boards.
// Keyed by board slug so each board has its own collapsed set.

const KEY = 'project-planning-tree:collapsed-lists:v1';

interface Stored {
  [boardSlug: string]: string[];
}

function load(): Stored {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Stored;
  } catch {
    return {};
  }
}

function persist(value: Stored): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function loadCollapsed(boardSlug: string): Set<string> {
  const all = load();
  const arr = all[boardSlug];
  return new Set(Array.isArray(arr) ? arr : []);
}

export function saveCollapsed(boardSlug: string, ids: Set<string>): void {
  const all = load();
  if (ids.size === 0) delete all[boardSlug];
  else all[boardSlug] = Array.from(ids);
  persist(all);
}
