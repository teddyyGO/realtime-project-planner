import type { BoardCardRecord, ChecklistGroup, ChecklistItem } from '../collab/yRoom';

export interface ImportedChecklistItem {
  text: string;
  done?: boolean;
}

export interface ImportedChecklistGroup {
  title: string;
  items: ImportedChecklistItem[];
}

export interface ImportedBoardCard {
  title: string;
  description?: string;
  labels?: string[];
  /** Single flat checklist — becomes a "Checklist" group on import. */
  checklist?: ImportedChecklistItem[];
  /** Multiple named checklists (preferred shape). */
  checklists?: ImportedChecklistGroup[];
  dueDate?: string;
  done?: boolean;
  /**
   * Optional target list NAME (not id). If present, the import dialog offers
   * a "Use list assignments from JSON" mode that creates the named lists if
   * they don't exist.
   */
  list?: string;
}

export interface ImportedBoard {
  cards: ImportedBoardCard[];
  /**
   * `true` if the source JSON had explicit per-card list assignments
   * (either via a top-level `lists` shape or per-card `list` fields).
   * Used by the import dialog to offer the multi-list mode.
   */
  hasListAssignments: boolean;
  /** Distinct list names mentioned, in first-seen order. */
  listNames: string[];
  /** Optional top-level color → name map for labels. */
  labelNames?: Record<string, string>;
}

export class BoardImportError extends Error {}

const ALLOWED_HEX = /^#[0-9a-f]{6}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function parseBoardImportFile(file: File): Promise<ImportedBoard> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new BoardImportError(`Not valid JSON: ${(err as Error).message}`);
  }
  return parseBoardImportValue(parsed);
}

/**
 * Accepts several shapes (so generated JSON can be pragmatic):
 *   1) Bare array of cards: `[{title:'...'}, ...]`
 *   2) `{ cards: [...] }` — all in one list (user picks at import time)
 *   3) `{ cards: [{list:'To do', title:'...'}, {list:'Done', ...}] }` — per-card list assignment
 *   4) `{ lists: [{ title:'To do', cards: [...] }, ...] }` — fully structured, export round-trip
 * Returns a normalized result with a `hasListAssignments` hint for the UI.
 */
export function parseBoardImportValue(parsed: unknown): ImportedBoard {
  const cards: ImportedBoardCard[] = [];
  let hasListAssignments = false;
  let labelNames: Record<string, string> | undefined;
  const listNamesSeen: string[] = [];
  const noteListName = (name: string | undefined) => {
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!listNamesSeen.includes(trimmed)) listNamesSeen.push(trimmed);
  };

  let rawCards: unknown[];
  if (Array.isArray(parsed)) {
    rawCards = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as {
      version?: number;
      kind?: string;
      cards?: unknown[];
      lists?: Array<{ title?: unknown; cards?: unknown[] }>;
      labelNames?: unknown;
    };
    if (obj.labelNames && typeof obj.labelNames === 'object') {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj.labelNames as Record<string, unknown>)) {
        if (typeof v === 'string' && ALLOWED_HEX.test(k)) {
          const trimmed = v.trim().slice(0, 32);
          if (trimmed) map[k] = trimmed;
        }
      }
      if (Object.keys(map).length > 0) labelNames = map;
    }
    if (obj.version !== undefined && obj.version !== 1) {
      throw new BoardImportError('Unsupported version (expected 1)');
    }
    if (obj.kind && obj.kind !== 'board') {
      throw new BoardImportError(`Wrong kind: expected "board", got "${obj.kind}"`);
    }
    if (Array.isArray(obj.lists)) {
      // Fully-structured: every card inherits its list's title.
      rawCards = [];
      for (const l of obj.lists) {
        const listTitle = typeof l?.title === 'string' ? l.title : 'Untitled';
        noteListName(listTitle);
        if (!Array.isArray(l?.cards)) continue;
        for (const c of l.cards) {
          if (c && typeof c === 'object') {
            (c as ImportedBoardCard).list = (c as ImportedBoardCard).list ?? listTitle;
          }
          rawCards.push(c);
        }
      }
      hasListAssignments = true;
    } else if (Array.isArray(obj.cards)) {
      rawCards = obj.cards;
    } else {
      throw new BoardImportError('Expected `cards` or `lists` array');
    }
  } else {
    throw new BoardImportError('Expected an object or array');
  }

  rawCards.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') {
      throw new BoardImportError(`cards[${i}] is not an object`);
    }
    const c = raw as ImportedBoardCard;
    if (typeof c.title !== 'string' || !c.title.trim()) {
      throw new BoardImportError(`cards[${i}].title must be a non-empty string`);
    }
    const labels = Array.isArray(c.labels)
      ? c.labels.filter((l) => typeof l === 'string' && ALLOWED_HEX.test(l))
      : undefined;
    const checklist = Array.isArray(c.checklist)
      ? c.checklist
          .filter(
            (it): it is { text: string; done?: boolean } =>
              !!it && typeof (it as { text?: unknown }).text === 'string',
          )
          .map((it) => ({ text: it.text.trim(), done: !!it.done }))
          .filter((it) => it.text.length > 0)
      : undefined;
    const checklists = Array.isArray(c.checklists)
      ? c.checklists
          .filter(
            (g): g is { title: string; items: Array<{ text: string; done?: boolean }> } =>
              !!g && typeof (g as { title?: unknown }).title === 'string',
          )
          .map((g) => ({
            title: g.title.trim().slice(0, 64) || 'Checklist',
            items: Array.isArray(g.items)
              ? g.items
                  .filter(
                    (it): it is { text: string; done?: boolean } =>
                      !!it && typeof (it as { text?: unknown }).text === 'string',
                  )
                  .map((it) => ({ text: it.text.trim(), done: !!it.done }))
                  .filter((it) => it.text.length > 0)
              : [],
          }))
      : undefined;
    if (c.dueDate !== undefined && typeof c.dueDate === 'string' && !ISO_DATE.test(c.dueDate)) {
      throw new BoardImportError(
        `cards[${i}].dueDate must be ISO format "YYYY-MM-DD" (got "${c.dueDate}")`,
      );
    }
    const listName = typeof c.list === 'string' ? c.list.trim() : undefined;
    if (listName) {
      hasListAssignments = true;
      noteListName(listName);
    }
    cards.push({
      title: c.title.trim().slice(0, 200),
      ...(typeof c.description === 'string' ? { description: c.description.slice(0, 8000) } : {}),
      ...(labels && labels.length > 0 ? { labels } : {}),
      ...(checklist && checklist.length > 0 ? { checklist } : {}),
      ...(checklists && checklists.length > 0 ? { checklists } : {}),
      ...(typeof c.dueDate === 'string' ? { dueDate: c.dueDate } : {}),
      ...(c.done === true ? { done: true } : {}),
      ...(listName ? { list: listName } : {}),
    });
  });

  return { cards, hasListAssignments, listNames: listNamesSeen, ...(labelNames ? { labelNames } : {}) };
}

/**
 * Convert the imported card shape into the runtime BoardCardRecord shape (with
 * id-stamped checklist items + groups so future edits work). Always writes
 * `checklists` (the new shape); falls back to wrapping a flat `checklist` into
 * a default group. Strips the `list` field.
 */
export function toBoardCardRecord(
  imported: ImportedBoardCard,
): Omit<BoardCardRecord, 'listId' | 'index'> {
  let cliCounter = 0;
  const stamp = () =>
    `cli-i-${Date.now().toString(36)}-${cliCounter++}-${Math.random().toString(36).slice(2, 6)}`;
  const stampGroup = () =>
    `chk-i-${Date.now().toString(36)}-${cliCounter++}-${Math.random().toString(36).slice(2, 6)}`;

  let checklists: ChecklistGroup[] | undefined;
  if (Array.isArray(imported.checklists) && imported.checklists.length > 0) {
    checklists = imported.checklists.map((g) => ({
      id: stampGroup(),
      title: g.title,
      items: g.items.map<ChecklistItem>((it) => ({
        id: stamp(),
        text: it.text,
        done: it.done ?? false,
      })),
    }));
  } else if (Array.isArray(imported.checklist) && imported.checklist.length > 0) {
    checklists = [
      {
        id: stampGroup(),
        title: 'Checklist',
        items: imported.checklist.map<ChecklistItem>((it) => ({
          id: stamp(),
          text: it.text,
          done: it.done ?? false,
        })),
      },
    ];
  }
  return {
    title: imported.title,
    description: imported.description ?? '',
    labels: imported.labels ?? [],
    checklists: checklists ?? [],
    ...(imported.dueDate ? { dueDate: imported.dueDate } : {}),
    ...(imported.done === true ? { done: true } : {}),
  };
}
