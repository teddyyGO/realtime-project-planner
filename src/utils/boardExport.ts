import type { ListWithCards } from '../collab/useYBoard';
import { downloadBlob } from './export';

export function exportBoardJson(
  title: string,
  lists: ListWithCards[],
  labelNames?: Record<string, string>,
): void {
  // Export only the visible structure — not the Yjs ids — so the file is
  // human-readable, AI-editable, and round-trippable via the import dialog.
  const payload = {
    version: 1,
    kind: 'board' as const,
    title,
    ...(labelNames && Object.keys(labelNames).length > 0 ? { labelNames } : {}),
    lists: lists.map((l) => ({
      title: l.title,
      cards: l.cards.map((c) => {
        const checklists =
          c.checklists && c.checklists.length > 0
            ? c.checklists
            : c.checklist && c.checklist.length > 0
              ? [{ id: 'legacy', title: 'Checklist', items: c.checklist }]
              : undefined;
        return {
          title: c.title,
          ...(c.description ? { description: c.description } : {}),
          ...(c.labels && c.labels.length > 0 ? { labels: c.labels } : {}),
          ...(checklists
            ? {
                checklists: checklists.map((g) => ({
                  title: g.title,
                  items: g.items.map((it) => ({ text: it.text, done: it.done })),
                })),
              }
            : {}),
          ...(c.dueDate ? { dueDate: c.dueDate } : {}),
          ...(c.done ? { done: true } : {}),
        };
      }),
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const safe = title.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
  downloadBlob(`${safe}-${timestamp()}.json`, blob);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
