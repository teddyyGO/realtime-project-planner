import { useEffect, useState } from 'react';
import { applyTheme, loadTheme, resolveTheme, saveTheme, type ThemeMode } from '../utils/theme';

const ORDER: ThemeMode[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};
const ICON: Record<ThemeMode, string> = {
  system: '◐',
  light: '☀',
  dark: '☾',
};

/** Mount once at the App root: applies + listens for system theme changes. */
export function ThemeRoot({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(loadTheme);

  useEffect(() => {
    applyTheme(resolveTheme(mode));
    saveTheme(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(resolveTheme('system'));
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ThemeMode>;
      setMode(ce.detail);
    };
    window.addEventListener('theme:set', handler);
    return () => window.removeEventListener('theme:set', handler);
  }, []);

  return <>{children}</>;
}

/** Small button users click to cycle theme. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(loadTheme);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ThemeMode>;
      setMode(ce.detail);
    };
    window.addEventListener('theme:set', handler);
    return () => window.removeEventListener('theme:set', handler);
  }, []);

  const cycle = () => {
    const i = ORDER.indexOf(mode);
    const next = ORDER[(i + 1) % ORDER.length];
    setMode(next);
    window.dispatchEvent(new CustomEvent('theme:set', { detail: next }));
  };

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABEL[mode]} (click to cycle)`}
      aria-label={`Theme: ${LABEL[mode]} — click to cycle`}
      className="text-sm px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-ink dark:text-slate-100 inline-flex items-center gap-1.5"
    >
      <span aria-hidden>{ICON[mode]}</span>
      <span className="text-xs text-muted dark:text-slate-400">{LABEL[mode]}</span>
    </button>
  );
}
