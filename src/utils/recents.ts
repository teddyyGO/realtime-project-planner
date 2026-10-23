const KEY = 'project-planning-tree:recents:v1';
const MAX = 50;

export type RecentKind = 'tree' | 'board';

export interface RecentProject {
  slug: string;
  title: string;
  lastOpenedAt: number;
  /** 'tree' or 'board'. Legacy entries without this field are treated as 'tree'. */
  kind: RecentKind;
}

interface RawRecent {
  slug?: unknown;
  title?: unknown;
  lastOpenedAt?: unknown;
  kind?: unknown;
}

function normalize(raw: RawRecent): RecentProject | null {
  if (typeof raw?.slug !== 'string') return null;
  if (typeof raw?.lastOpenedAt !== 'number') return null;
  const title = typeof raw.title === 'string' ? raw.title : 'Untitled';
  const kind: RecentKind = raw.kind === 'board' ? 'board' : 'tree';
  return { slug: raw.slug, title, lastOpenedAt: raw.lastOpenedAt, kind };
}

export function loadRecents(filter?: RecentKind): RecentProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecentProject[] = [];
    for (const r of parsed) {
      const n = normalize(r);
      if (!n) continue;
      if (filter && n.kind !== filter) continue;
      out.push(n);
    }
    return out.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, MAX);
  } catch {
    return [];
  }
}

function loadAllRaw(): RecentProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize).filter((r): r is RecentProject => r !== null);
  } catch {
    return [];
  }
}

function persist(list: RecentProject[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore quota errors
  }
}

export function recordVisit(
  kind: RecentKind,
  slug: string,
  title: string,
  when: number = Date.now(),
): void {
  if (typeof window === 'undefined') return;
  const current = loadAllRaw();
  const idx = current.findIndex((r) => r.slug === slug && r.kind === kind);
  if (idx >= 0) {
    current[idx] = { ...current[idx], title, lastOpenedAt: when };
  } else {
    current.unshift({ slug, title, lastOpenedAt: when, kind });
  }
  current.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  persist(current);
}

export function updateRecentTitle(kind: RecentKind, slug: string, title: string): void {
  if (typeof window === 'undefined') return;
  const current = loadAllRaw();
  const idx = current.findIndex((r) => r.slug === slug && r.kind === kind);
  if (idx < 0) return;
  current[idx] = { ...current[idx], title };
  persist(current);
}

export function removeRecent(kind: RecentKind, slug: string): void {
  if (typeof window === 'undefined') return;
  const current = loadAllRaw().filter((r) => !(r.slug === slug && r.kind === kind));
  persist(current);
}

export function relativeTime(when: number | string): string {
  const ts = typeof when === 'number' ? when : new Date(when).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMs = Date.now() - ts;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 30) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  if (day < 365) return `${Math.floor(day / 30)}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}
