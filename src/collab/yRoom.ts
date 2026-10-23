import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import type { Awareness } from 'y-protocols/awareness';

// ---------- Tree shapes (existing) -----------------------------------

export interface NodeRecord {
  position: { x: number; y: number };
  data: {
    label: string;
    bgColor: string;
    textColor: string;
    textColorAuto: boolean;
    borderStyle: 'none' | 'thin' | 'thick';
  };
}

export interface EdgeRecord {
  source: string;
  target: string;
  /** Which side of the source node the connection leaves. Defaults to right. */
  sourceHandle?: string | null;
  /** Which side of the target node the connection enters. Defaults to left. */
  targetHandle?: string | null;
  /** Optional text rendered along the edge (e.g. "depends on", "yes"). */
  label?: string;
}

// ---------- Board shapes (new) ---------------------------------------

export interface ListRecord {
  title: string;
  index: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface BoardCardRecord {
  listId: string;
  index: number;
  title: string;
  description?: string;
  labels?: string[];
  /** @deprecated single-checklist field — kept for backward-compat reads. New
   * writes go to `checklists` instead. */
  checklist?: ChecklistItem[];
  /** Multiple named checklist groups (Trello-style). When present, this is
   * the source of truth and `checklist` is ignored. */
  checklists?: ChecklistGroup[];
  /** ISO date string, e.g. "2026-06-20". */
  dueDate?: string;
  /** Marks the card as complete. Renders with strikethrough + faded look. */
  done?: boolean;
  /** Soft-deleted; hidden from columns unless "Show archived" is on. */
  archived?: boolean;
}

// ---------- Base room (shared) ---------------------------------------

export interface BaseRoom {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  awareness: Awareness;
  /** Free-form room metadata. `name` holds the editable project title. */
  meta: Y.Map<unknown>;
  /** Symbol used as `origin` for local transactions so the UndoManager can filter. */
  localOrigin: symbol;
  destroyBase: () => void;
}

export interface TreeRoom extends BaseRoom {
  kind: 'tree';
  nodes: Y.Map<NodeRecord>;
  edges: Y.Map<EdgeRecord>;
  undoManager: Y.UndoManager;
  destroy: () => void;
}

export interface BoardRoom extends BaseRoom {
  kind: 'board';
  lists: Y.Map<ListRecord>;
  cards: Y.Map<BoardCardRecord>;
  undoManager: Y.UndoManager;
  destroy: () => void;
}

/** Backwards-compat alias — most of the existing tree code imports `Room`. */
export type Room = TreeRoom;

function resolveWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000/collab';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/collab`;
}

/**
 * Maps a (kind, slug) pair to the Hocuspocus document name used on the wire
 * and as the Postgres primary key. Trees stay unprefixed so existing rooms
 * from before the boards feature keep working; boards get a `board-` prefix
 * so the server knows which seed to apply for a brand-new room.
 */
export function makeRoomName(kind: 'tree' | 'board', slug: string): string {
  return kind === 'board' ? `board-${slug}` : slug;
}

function createBaseRoom(roomName: string): BaseRoom {
  const doc = new Y.Doc();
  const meta = doc.getMap<unknown>('meta');
  const localOrigin = Symbol('local-edit');

  const provider = new HocuspocusProvider({
    url: resolveWsUrl(),
    name: roomName,
    document: doc,
  });
  const awareness = provider.awareness;
  if (!awareness) {
    throw new Error('HocuspocusProvider awareness unexpectedly null');
  }

  return {
    doc,
    provider,
    awareness,
    meta,
    localOrigin,
    destroyBase() {
      provider.destroy();
      doc.destroy();
    },
  };
}

// ---------- Tree binding (existing behavior) -------------------------

export function createRoom(slug: string): TreeRoom {
  const base = createBaseRoom(makeRoomName('tree', slug));
  const nodes = base.doc.getMap<NodeRecord>('nodes');
  const edges = base.doc.getMap<EdgeRecord>('edges');

  // We don't track `meta` in the UndoManager — renaming the project shouldn't
  // share an undo stack with canvas edits.
  const undoManager = new Y.UndoManager([nodes, edges], {
    captureTimeout: 400,
    trackedOrigins: new Set([base.localOrigin]),
  });

  return {
    ...base,
    kind: 'tree',
    nodes,
    edges,
    undoManager,
    destroy() {
      undoManager.destroy();
      base.destroyBase();
    },
  };
}

// ---------- Board binding (new) --------------------------------------

export function createBoardRoom(slug: string): BoardRoom {
  const base = createBaseRoom(makeRoomName('board', slug));
  const lists = base.doc.getMap<ListRecord>('lists');
  const cards = base.doc.getMap<BoardCardRecord>('cards');

  const undoManager = new Y.UndoManager([lists, cards], {
    captureTimeout: 400,
    trackedOrigins: new Set([base.localOrigin]),
  });

  return {
    ...base,
    kind: 'board',
    lists,
    cards,
    undoManager,
    destroy() {
      undoManager.destroy();
      base.destroyBase();
    },
  };
}
