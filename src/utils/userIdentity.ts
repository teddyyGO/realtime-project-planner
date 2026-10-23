const IDENTITY_KEY = 'project-planning-tree:identity:v1';

export const PRESET_COLORS = [
  '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#a855f7', '#ec4899', '#14b8a6', '#84cc16', '#f97316',
];

export interface UserIdentity {
  name: string;
  color: string;
  /** `true` once the user has explicitly chosen a nickname (vs. anonymous default). */
  chosen?: boolean;
}

export function randomColor(): string {
  return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
}

export function loadIdentity(): UserIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserIdentity;
    if (parsed && typeof parsed.name === 'string' && typeof parsed.color === 'string') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveIdentity(id: UserIdentity): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
  } catch {
    // ignore
  }
}
