import { useCallback, useEffect, useState } from 'react';
import type {
  BoardCardRecord,
  BoardRoom,
  ChecklistGroup,
  ChecklistItem,
  ListRecord,
} from './yRoom';

const INDEX_STEP = 1024;
export const DEFAULT_QUICK_FLAG_COLOR = '#eab308';
export const DEFAULT_DONE_COLOR = '#22c55e';
// Tiny per-write jitter so two clients computing the same midpoint between the
// same two neighbors don't end up with byte-identical indices. Sub-integer so
// the INDEX_STEP intuition still holds.
function jitter(): number {
  return (Math.random() - 0.5) * 0.5;
}

function nextId(prefix: string, clientId?: number): string {
  const c = clientId ? clientId.toString(36) : 'l';
  return `${prefix}-${c}-${Math.random().toString(36).slice(2, 8)}`;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'string');
}

export interface ListWithCards {
  id: string;
  title: string;
  index: number;
  cards: BoardCardWithId[];
}

export interface BoardCardWithId extends BoardCardRecord {
  id: string;
}

export interface UseYBoard {
  listsSorted: ListWithCards[];
  cardsById: Map<string, BoardCardWithId>;
  addList: (title?: string) => string;
  renameList: (id: string, title: string) => void;
  deleteList: (id: string) => void;
  moveList: (id: string, afterId: string | null) => void;
  addCard: (listId: string, title: string) => string;
  updateCard: (id: string, patch: Partial<Omit<BoardCardRecord, 'index' | 'listId'>>) => void;
  deleteCard: (id: string) => void;
  /**
   * Move a card. `targetListId` is the destination column. `beforeCardId` is the
   * card immediately AFTER the dropped position in the destination list, or null
   * to drop at the end. Order is computed via sparse float indices.
   */
  moveCard: (cardId: string, targetListId: string, beforeCardId: string | null) => void;
  /** Add/remove a label color on a card; reads fresh from Y to avoid stale-state clobbering. */
  toggleLabel: (cardId: string, color: string) => void;
  /** Board-level label color → name map (Trello-style). Live-synced via meta. */
  labelNames: Record<string, string>;
  /** Rename a label color at the board level. Empty string clears the name. */
  setLabelName: (color: string, name: string) => void;
  /** Color toggled by the ★ quick-flag button on every card. Board-wide. */
  quickFlagColor: string;
  /** Change the color the ★ button toggles, for everyone in the room. */
  setQuickFlagColor: (color: string) => void;
  /** Dedicated single-key shortcut that toggles the quick-flag on the hovered
   * card. `null` = no dedicated key (only the palette 1-9 shortcuts). */
  flagKeybind: string | null;
  /** Set the dedicated flag keybind. Pass an empty string / null to clear. */
  setFlagKeybind: (key: string | null) => void;
  /** Color that tints a done card. Board-wide, defaults to green. */
  doneColor: string;
  /** Set the done tint color for everyone in the room. */
  setDoneColor: (color: string) => void;
  /** Dedicated single-key shortcut that toggles done on the hovered card. */
  doneKeybind: string | null;
  /** Set the dedicated done keybind. Pass an empty string / null to clear. */
  setDoneKeybind: (key: string | null) => void;
  /** Mark a card complete / incomplete; reads fresh from Y. */
  toggleCardDone: (cardId: string) => void;
  /** Archive / unarchive a card. Archived cards are hidden unless the
   * "Show archived" flag is enabled. */
  setCardArchived: (cardId: string, archived: boolean) => void;
  /** Permanently delete all archived cards. Returns count deleted. */
  purgeArchivedCards: () => number;
  /** All archived cards (for the archive drawer). */
  archivedCards: BoardCardWithId[];
  /**
   * Batch-append cards into a list. Each card is laid out with sparse indices
   * after the list's last existing card. Returns the number actually imported.
   */
  importCardsIntoList: (
    listId: string,
    cards: Array<Omit<BoardCardRecord, 'listId' | 'index'>>,
  ) => number;
  /**
   * Multi-list import. Each group targets a list by NAME — if a list with
   * that title already exists, reuses it; otherwise creates a new list at
   * the end. Returns total cards inserted.
   */
  importCardsMultiList: (
    groups: Array<{
      listName: string;
      cards: Array<Omit<BoardCardRecord, 'listId' | 'index'>>;
    }>,
  ) => number;
  /** Wipe all lists/cards and seed from a template (used right after creation). */
  applyTemplate: (template: {
    meta?: { name?: string };
    lists: Array<{ id: string; record: ListRecord }>;
    cards: Array<{ id: string; record: BoardCardRecord }>;
  }) => void;
  /** Add a new named checklist group (Trello-style). Returns the group id. */
  addChecklistGroup: (cardId: string, title: string) => string | null;
  renameChecklistGroup: (cardId: string, groupId: string, title: string) => void;
  removeChecklistGroup: (cardId: string, groupId: string) => void;
  addChecklistItem: (cardId: string, groupId: string, text: string) => void;
  updateChecklistItem: (
    cardId: string,
    groupId: string,
    itemId: string,
    patch: { text?: string; done?: boolean },
  ) => void;
  removeChecklistItem: (cardId: string, groupId: string, itemId: string) => void;
}

/**
 * Backward-compat read: returns the card's checklist groups. If a legacy
 * single `checklist` is the only data, it's surfaced as a single "Checklist"
 * group so the UI is always group-shaped.
 */
export function readChecklistGroups(card: BoardCardRecord): ChecklistGroup[] {
  if (Array.isArray(card.checklists) && card.checklists.length > 0) return card.checklists;
  if (Array.isArray(card.checklist) && card.checklist.length > 0) {
    return [{ id: 'legacy', title: 'Checklist', items: card.checklist }];
  }
  return [];
}

function recordToCard(id: string, record: BoardCardRecord): BoardCardWithId {
  return { ...record, id };
}

export function useYBoard(room: BoardRoom): UseYBoard {
  const { doc, lists: yLists, cards: yCards, meta, localOrigin, awareness } = room;

  const [listsSorted, setListsSorted] = useState<ListWithCards[]>([]);
  const [cardsById, setCardsById] = useState<Map<string, BoardCardWithId>>(new Map());
  const [archivedCards, setArchivedCards] = useState<BoardCardWithId[]>([]);
  const [labelNames, setLabelNamesState] = useState<Record<string, string>>(() => {
    const raw = meta.get('labelNames');
    return isStringRecord(raw) ? { ...raw } : {};
  });
  const [quickFlagColor, setQuickFlagColorState] = useState<string>(() => {
    const raw = meta.get('quickFlagColor');
    return typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw : DEFAULT_QUICK_FLAG_COLOR;
  });
  const [flagKeybind, setFlagKeybindState] = useState<string | null>(() => {
    const raw = meta.get('flagKeybind');
    return typeof raw === 'string' && /^[a-z0-9]$/i.test(raw) ? raw.toLowerCase() : null;
  });
  const [doneColor, setDoneColorState] = useState<string>(() => {
    const raw = meta.get('doneColor');
    return typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw : DEFAULT_DONE_COLOR;
  });
  const [doneKeybind, setDoneKeybindState] = useState<string | null>(() => {
    const raw = meta.get('doneKeybind');
    return typeof raw === 'string' && /^[a-z0-9]$/i.test(raw) ? raw.toLowerCase() : null;
  });

  useEffect(() => {
    const sync = () => {
      const raw = meta.get('labelNames');
      setLabelNamesState(isStringRecord(raw) ? { ...raw } : {});
      const flag = meta.get('quickFlagColor');
      setQuickFlagColorState(
        typeof flag === 'string' && /^#[0-9a-f]{6}$/i.test(flag) ? flag : DEFAULT_QUICK_FLAG_COLOR,
      );
      const kb = meta.get('flagKeybind');
      setFlagKeybindState(
        typeof kb === 'string' && /^[a-z0-9]$/i.test(kb) ? kb.toLowerCase() : null,
      );
      const dc = meta.get('doneColor');
      setDoneColorState(
        typeof dc === 'string' && /^#[0-9a-f]{6}$/i.test(dc) ? dc : DEFAULT_DONE_COLOR,
      );
      const dk = meta.get('doneKeybind');
      setDoneKeybindState(
        typeof dk === 'string' && /^[a-z0-9]$/i.test(dk) ? dk.toLowerCase() : null,
      );
    };
    meta.observe(sync);
    return () => meta.unobserve(sync);
  }, [meta]);

  const setLabelName = useCallback(
    (color: string, name: string) => {
      const trimmed = name.trim().slice(0, 32);
      doc.transact(() => {
        const raw = meta.get('labelNames');
        const cur: Record<string, string> = isStringRecord(raw) ? { ...raw } : {};
        if (!trimmed) delete cur[color];
        else cur[color] = trimmed;
        if (Object.keys(cur).length === 0) meta.delete('labelNames');
        else meta.set('labelNames', cur);
      }, localOrigin);
    },
    [doc, meta, localOrigin],
  );

  const setQuickFlagColor = useCallback(
    (color: string) => {
      if (!/^#[0-9a-f]{6}$/i.test(color)) return;
      doc.transact(() => {
        if (color === DEFAULT_QUICK_FLAG_COLOR) meta.delete('quickFlagColor');
        else meta.set('quickFlagColor', color);
      }, localOrigin);
    },
    [doc, meta, localOrigin],
  );

  const setFlagKeybind = useCallback(
    (key: string | null) => {
      const normalized = typeof key === 'string' ? key.trim().toLowerCase() : '';
      const valid = /^[a-z0-9]$/.test(normalized) ? normalized : null;
      doc.transact(() => {
        if (valid) meta.set('flagKeybind', valid);
        else meta.delete('flagKeybind');
      }, localOrigin);
    },
    [doc, meta, localOrigin],
  );

  const setDoneColor = useCallback(
    (color: string) => {
      if (!/^#[0-9a-f]{6}$/i.test(color)) return;
      doc.transact(() => {
        if (color === DEFAULT_DONE_COLOR) meta.delete('doneColor');
        else meta.set('doneColor', color);
      }, localOrigin);
    },
    [doc, meta, localOrigin],
  );

  const setDoneKeybind = useCallback(
    (key: string | null) => {
      const normalized = typeof key === 'string' ? key.trim().toLowerCase() : '';
      const valid = /^[a-z0-9]$/.test(normalized) ? normalized : null;
      doc.transact(() => {
        if (valid) meta.set('doneKeybind', valid);
        else meta.delete('doneKeybind');
      }, localOrigin);
    },
    [doc, meta, localOrigin],
  );

  useEffect(() => {
    const rebuild = () => {
      // Build cards-by-id, grouped & sorted per list. Archived cards are
      // kept out of the visible columns but surfaced separately so the
      // archive drawer can list them.
      const byList = new Map<string, BoardCardWithId[]>();
      const cardsMap = new Map<string, BoardCardWithId>();
      const archived: BoardCardWithId[] = [];
      yCards.forEach((record, id) => {
        const card = recordToCard(id, record);
        cardsMap.set(id, card);
        if (record.archived) {
          archived.push(card);
          return;
        }
        const bucket = byList.get(record.listId) ?? [];
        bucket.push(card);
        byList.set(record.listId, bucket);
      });
      for (const bucket of byList.values()) {
        bucket.sort((a, b) => a.index - b.index);
      }
      archived.sort((a, b) => b.index - a.index);
      setArchivedCards(archived);

      // Build sorted lists with their cards.
      const lists: ListWithCards[] = [];
      const liveListIds = new Set<string>();
      yLists.forEach((record, id) => {
        liveListIds.add(id);
        lists.push({
          id,
          title: record.title,
          index: record.index,
          cards: byList.get(id) ?? [],
        });
      });
      lists.sort((a, b) => a.index - b.index);

      // Rescue orphan cards (listId pointing at a deleted list). This happens
      // when User A deletes a list while User B concurrently moves/adds a card
      // into it — Yjs merges both writes, and the card would otherwise be
      // invisible. Reparent to the first surviving list so the data is at
      // least reachable. If no list survives, recreate a fallback list.
      const orphanBucketKeys: string[] = [];
      byList.forEach((_b, listId) => {
        if (!liveListIds.has(listId)) orphanBucketKeys.push(listId);
      });
      if (orphanBucketKeys.length > 0) {
        const orphans: BoardCardWithId[] = [];
        for (const k of orphanBucketKeys) {
          for (const c of byList.get(k) ?? []) orphans.push(c);
        }
        // Schedule a single rescue transaction outside this render pass.
        queueMicrotask(() => {
          doc.transact(() => {
            let target = lists[0]?.id;
            if (!target) {
              target = `list-rescued-${Math.random().toString(36).slice(2, 8)}`;
              yLists.set(target, { title: 'Recovered', index: 0 });
            }
            for (const o of orphans) {
              const cur = yCards.get(o.id);
              if (!cur) continue;
              if (yLists.has(cur.listId)) continue; // someone else fixed it
              yCards.set(o.id, { ...cur, listId: target });
            }
          }, localOrigin);
        });
      }

      setListsSorted(lists);
      setCardsById(cardsMap);
    };

    rebuild();
    yLists.observeDeep(rebuild);
    yCards.observeDeep(rebuild);
    return () => {
      yLists.unobserveDeep(rebuild);
      yCards.unobserveDeep(rebuild);
    };
  }, [yLists, yCards, doc, localOrigin]);

  const transact = useCallback(
    (fn: () => void) => doc.transact(fn, localOrigin),
    [doc, localOrigin],
  );

  // ---------- Index helpers --------------------------------------------

  const computeListIndexAfter = useCallback(
    (afterId: string | null): number => {
      const sorted: ListRecord[] = [];
      const ids: string[] = [];
      yLists.forEach((record, id) => {
        sorted.push(record);
        ids.push(id);
      });
      const order = ids
        .map((id, i) => ({ id, index: sorted[i].index }))
        .sort((a, b) => a.index - b.index);

      if (order.length === 0) return INDEX_STEP + jitter();
      if (afterId === null) return order[0].index - INDEX_STEP + jitter();
      const i = order.findIndex((o) => o.id === afterId);
      if (i < 0 || i === order.length - 1) {
        return order[order.length - 1].index + INDEX_STEP + jitter();
      }
      return (order[i].index + order[i + 1].index) / 2 + jitter();
    },
    [yLists],
  );

  const computeCardIndex = useCallback(
    (listId: string, beforeCardId: string | null, excludeCardId?: string): number => {
      const bucket: { id: string; index: number }[] = [];
      yCards.forEach((record, id) => {
        if (id === excludeCardId) return;
        if (record.listId !== listId) return;
        bucket.push({ id, index: record.index });
      });
      bucket.sort((a, b) => a.index - b.index);

      if (bucket.length === 0) return INDEX_STEP + jitter();
      if (beforeCardId === null) {
        return bucket[bucket.length - 1].index + INDEX_STEP + jitter();
      }
      const i = bucket.findIndex((c) => c.id === beforeCardId);
      if (i < 0) return bucket[bucket.length - 1].index + INDEX_STEP + jitter();
      if (i === 0) return bucket[0].index - INDEX_STEP + jitter();
      return (bucket[i - 1].index + bucket[i].index) / 2 + jitter();
    },
    [yCards],
  );

  // ---------- List mutators --------------------------------------------

  const addList = useCallback(
    (title: string = 'New list'): string => {
      const id = nextId('list', awareness.clientID);
      const index = computeListIndexAfter(
        listsSorted.length === 0 ? null : listsSorted[listsSorted.length - 1].id,
      );
      transact(() => {
        yLists.set(id, { title, index });
      });
      return id;
    },
    [transact, yLists, awareness.clientID, computeListIndexAfter, listsSorted],
  );

  const renameList = useCallback(
    (id: string, title: string) => {
      transact(() => {
        const cur = yLists.get(id);
        if (!cur) return;
        yLists.set(id, { ...cur, title: title.trim() || 'Untitled list' });
      });
    },
    [transact, yLists],
  );

  const deleteList = useCallback(
    (id: string) => {
      transact(() => {
        yLists.delete(id);
        // Cascade-delete cards belonging to this list.
        const toDelete: string[] = [];
        yCards.forEach((rec, cid) => {
          if (rec.listId === id) toDelete.push(cid);
        });
        for (const cid of toDelete) yCards.delete(cid);
      });
    },
    [transact, yLists, yCards],
  );

  const moveList = useCallback(
    (id: string, afterId: string | null) => {
      transact(() => {
        const cur = yLists.get(id);
        if (!cur) return;
        const newIndex = computeListIndexAfter(afterId === id ? null : afterId);
        if (newIndex === cur.index) return;
        yLists.set(id, { ...cur, index: newIndex });
      });
    },
    [transact, yLists, computeListIndexAfter],
  );

  // ---------- Card mutators --------------------------------------------

  const addCard = useCallback(
    (listId: string, title: string): string => {
      const id = nextId('card', awareness.clientID);
      const index = computeCardIndex(listId, null);
      transact(() => {
        yCards.set(id, {
          listId,
          index,
          title: title.trim() || 'Untitled card',
          description: '',
          labels: [],
          checklist: [],
        });
      });
      return id;
    },
    [transact, yCards, awareness.clientID, computeCardIndex],
  );

  /**
   * KNOWN LIMITATION: a BoardCardRecord is stored as a single Y.Map value
   * (plain JS object). Two concurrent updates to DIFFERENT fields of the same
   * card resolve last-writer-wins for the whole record, so one peer's title
   * edit can drop another peer's label toggle on the same card. The intended
   * upgrade is to model each card as a nested Y.Map with Y.Text/Y.Array fields
   * so each field merges independently. Until then, prefer dedicated mutators
   * that read fresh from Y inside the transaction (see `toggleLabel`).
   */
  const updateCard = useCallback(
    (id: string, patch: Partial<Omit<BoardCardRecord, 'index' | 'listId'>>) => {
      transact(() => {
        const cur = yCards.get(id);
        if (!cur) return;
        yCards.set(id, { ...cur, ...patch });
      });
    },
    [transact, yCards],
  );

  const deleteCard = useCallback(
    (id: string) => {
      transact(() => {
        yCards.delete(id);
      });
    },
    [transact, yCards],
  );

  const moveCard = useCallback(
    (cardId: string, targetListId: string, beforeCardId: string | null) => {
      transact(() => {
        const cur = yCards.get(cardId);
        if (!cur) return;
        // The target list may have been deleted by a remote peer between the
        // user grabbing the card and dropping it. Drop the move silently
        // rather than orphan the card.
        if (!yLists.has(targetListId)) return;
        const newIndex = computeCardIndex(targetListId, beforeCardId, cardId);
        if (cur.listId === targetListId && cur.index === newIndex) return;
        yCards.set(cardId, { ...cur, listId: targetListId, index: newIndex });
      });
    },
    [transact, yLists, yCards, computeCardIndex],
  );

  /**
   * Toggle a label on a card. Reads the current labels FRESH from Yjs inside
   * the transaction so concurrent label toggles by other users (or stale React
   * snapshots) don't clobber each other's writes.
   */
  const toggleLabel = useCallback(
    (cardId: string, color: string) => {
      transact(() => {
        const cur = yCards.get(cardId);
        if (!cur) return;
        const labels: string[] = Array.isArray(cur.labels) ? cur.labels : [];
        const next = labels.includes(color)
          ? labels.filter((c) => c !== color)
          : [...labels, color];
        yCards.set(cardId, { ...cur, labels: next });
      });
    },
    [transact, yCards],
  );

  const toggleCardDone = useCallback(
    (cardId: string) => {
      transact(() => {
        const cur = yCards.get(cardId);
        if (!cur) return;
        yCards.set(cardId, { ...cur, done: !cur.done });
      });
    },
    [transact, yCards],
  );

  const setCardArchived = useCallback(
    (cardId: string, archived: boolean) => {
      transact(() => {
        const cur = yCards.get(cardId);
        if (!cur) return;
        if (!!cur.archived === archived) return;
        yCards.set(cardId, { ...cur, archived });
      });
    },
    [transact, yCards],
  );

  const purgeArchivedCards = useCallback((): number => {
    let count = 0;
    transact(() => {
      const ids: string[] = [];
      yCards.forEach((rec, id) => {
        if (rec.archived) ids.push(id);
      });
      for (const id of ids) {
        yCards.delete(id);
        count++;
      }
    });
    return count;
  }, [transact, yCards]);

  const applyTemplate = useCallback(
    (template: {
      meta?: { name?: string };
      lists: Array<{ id: string; record: ListRecord }>;
      cards: Array<{ id: string; record: BoardCardRecord }>;
    }) => {
      transact(() => {
        const meta = room.meta;
        yLists.forEach((_v, k) => yLists.delete(k));
        yCards.forEach((_v, k) => yCards.delete(k));
        if (template.meta?.name) meta.set('name', template.meta.name);
        for (const { id, record } of template.lists) yLists.set(id, record);
        for (const { id, record } of template.cards) yCards.set(id, record);
      });
    },
    [transact, room.meta, yLists, yCards],
  );

  const importCardsMultiList = useCallback(
    (
      groups: Array<{
        listName: string;
        cards: Array<Omit<BoardCardRecord, 'listId' | 'index'>>;
      }>,
    ): number => {
      // Map existing list titles (case-insensitive) to their ids so we can
      // reuse matching columns instead of creating duplicates.
      const titleToId = new Map<string, string>();
      yLists.forEach((rec, id) => titleToId.set(rec.title.trim().toLowerCase(), id));
      const listIndices = new Map<string, number>();
      yLists.forEach((rec) => {
        listIndices.set('', Math.max(listIndices.get('') ?? -INDEX_STEP, rec.index));
      });
      let listAppendIndex = (listIndices.get('') ?? -INDEX_STEP) + INDEX_STEP;

      let total = 0;
      transact(() => {
        for (const group of groups) {
          const key = group.listName.trim().toLowerCase();
          let listId = titleToId.get(key);
          if (!listId) {
            listId = nextId('list', awareness.clientID);
            yLists.set(listId, { title: group.listName.trim(), index: listAppendIndex });
            listAppendIndex += INDEX_STEP;
            titleToId.set(key, listId);
          }
          // Find this list's current max card index.
          let lastIndex = -INDEX_STEP;
          yCards.forEach((rec) => {
            if (rec.listId === listId && rec.index > lastIndex) lastIndex = rec.index;
          });
          group.cards.forEach((c, i) => {
            const cid = nextId('card', awareness.clientID);
            yCards.set(cid, {
              listId: listId!,
              index: lastIndex + (i + 1) * INDEX_STEP + jitter(),
              title: c.title,
              description: c.description ?? '',
              labels: Array.isArray(c.labels) ? c.labels : [],
              checklist: Array.isArray(c.checklist) ? c.checklist : [],
              ...(c.dueDate ? { dueDate: c.dueDate } : {}),
              ...(c.done === true ? { done: true } : {}),
            });
            total++;
          });
        }
      });
      return total;
    },
    [transact, yLists, yCards, awareness.clientID],
  );

  const importCardsIntoList = useCallback(
    (listId: string, cardsToImport: Array<Omit<BoardCardRecord, 'listId' | 'index'>>): number => {
      if (!yLists.has(listId)) return 0;
      let lastIndex = -INDEX_STEP;
      yCards.forEach((rec) => {
        if (rec.listId === listId && rec.index > lastIndex) lastIndex = rec.index;
      });
      let count = 0;
      transact(() => {
        cardsToImport.forEach((c, i) => {
          const id = nextId('card', awareness.clientID);
          yCards.set(id, {
            listId,
            index: lastIndex + (i + 1) * INDEX_STEP + jitter(),
            title: c.title,
            description: c.description ?? '',
            labels: Array.isArray(c.labels) ? c.labels : [],
            checklist: Array.isArray(c.checklist) ? c.checklist : [],
            ...(c.dueDate ? { dueDate: c.dueDate } : {}),
          });
          count++;
        });
      });
      return count;
    },
    [transact, yLists, yCards, awareness.clientID],
  );

  // ---------- Checklist mutators ---------------------------------------

  /**
   * Read the card's checklist groups, migrating a legacy single `checklist`
   * field into a default group on the fly. Mutators write back to the
   * `checklists` field exclusively.
   */
  const readGroups = useCallback((card: BoardCardRecord): ChecklistGroup[] => {
    if (Array.isArray(card.checklists) && card.checklists.length > 0) {
      return card.checklists.map((g) => ({
        id: g.id,
        title: g.title,
        items: Array.isArray(g.items) ? [...g.items] : [],
      }));
    }
    if (Array.isArray(card.checklist) && card.checklist.length > 0) {
      return [
        {
          id: 'legacy',
          title: 'Checklist',
          items: card.checklist.map((i) => ({ ...i })),
        },
      ];
    }
    return [];
  }, []);

  const writeGroups = useCallback(
    (cardId: string, groups: ChecklistGroup[]) => {
      transact(() => {
        const cur = yCards.get(cardId);
        if (!cur) return;
        const next = { ...cur, checklists: groups };
        if ('checklist' in next) delete (next as { checklist?: unknown }).checklist;
        yCards.set(cardId, next);
      });
    },
    [transact, yCards],
  );

  const addChecklistGroup = useCallback(
    (cardId: string, title: string): string | null => {
      const cur = yCards.get(cardId);
      if (!cur) return null;
      const trimmed = title.trim() || 'Checklist';
      const id = nextId('chk', awareness.clientID);
      const groups = readGroups(cur);
      groups.push({ id, title: trimmed.slice(0, 64), items: [] });
      writeGroups(cardId, groups);
      return id;
    },
    [yCards, readGroups, writeGroups, awareness.clientID],
  );

  const renameChecklistGroup = useCallback(
    (cardId: string, groupId: string, title: string) => {
      const cur = yCards.get(cardId);
      if (!cur) return;
      const groups = readGroups(cur);
      const idx = groups.findIndex((g) => g.id === groupId);
      if (idx < 0) return;
      groups[idx] = { ...groups[idx], title: title.trim().slice(0, 64) || 'Checklist' };
      writeGroups(cardId, groups);
    },
    [yCards, readGroups, writeGroups],
  );

  const removeChecklistGroup = useCallback(
    (cardId: string, groupId: string) => {
      const cur = yCards.get(cardId);
      if (!cur) return;
      const groups = readGroups(cur).filter((g) => g.id !== groupId);
      writeGroups(cardId, groups);
    },
    [yCards, readGroups, writeGroups],
  );

  const addChecklistItem = useCallback(
    (cardId: string, groupId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const cur = yCards.get(cardId);
      if (!cur) return;
      const groups = readGroups(cur);
      const idx = groups.findIndex((g) => g.id === groupId);
      if (idx < 0) return;
      const items: ChecklistItem[] = [
        ...groups[idx].items,
        { id: nextId('cli', awareness.clientID), text: trimmed, done: false },
      ];
      groups[idx] = { ...groups[idx], items };
      writeGroups(cardId, groups);
    },
    [yCards, readGroups, writeGroups, awareness.clientID],
  );

  const updateChecklistItem = useCallback(
    (
      cardId: string,
      groupId: string,
      itemId: string,
      patch: { text?: string; done?: boolean },
    ) => {
      const cur = yCards.get(cardId);
      if (!cur) return;
      const groups = readGroups(cur);
      const gi = groups.findIndex((g) => g.id === groupId);
      if (gi < 0) return;
      const items = [...groups[gi].items];
      const ii = items.findIndex((i) => i.id === itemId);
      if (ii < 0) return;
      items[ii] = {
        ...items[ii],
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.done !== undefined ? { done: patch.done } : {}),
      };
      groups[gi] = { ...groups[gi], items };
      writeGroups(cardId, groups);
    },
    [yCards, readGroups, writeGroups],
  );

  const removeChecklistItem = useCallback(
    (cardId: string, groupId: string, itemId: string) => {
      const cur = yCards.get(cardId);
      if (!cur) return;
      const groups = readGroups(cur);
      const gi = groups.findIndex((g) => g.id === groupId);
      if (gi < 0) return;
      const items = groups[gi].items.filter((i) => i.id !== itemId);
      groups[gi] = { ...groups[gi], items };
      writeGroups(cardId, groups);
    },
    [yCards, readGroups, writeGroups],
  );

  return {
    listsSorted,
    cardsById,
    addList,
    renameList,
    deleteList,
    moveList,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    toggleLabel,
    labelNames,
    setLabelName,
    quickFlagColor,
    setQuickFlagColor,
    flagKeybind,
    setFlagKeybind,
    doneColor,
    setDoneColor,
    doneKeybind,
    setDoneKeybind,
    toggleCardDone,
    setCardArchived,
    purgeArchivedCards,
    archivedCards,
    importCardsIntoList,
    importCardsMultiList,
    applyTemplate,
    addChecklistGroup,
    renameChecklistGroup,
    removeChecklistGroup,
    addChecklistItem,
    updateChecklistItem,
    removeChecklistItem,
  };
}
