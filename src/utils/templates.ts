import type { BoardCardRecord, EdgeRecord, ListRecord, NodeRecord } from '../collab/yRoom';

// ---------- Board templates ------------------------------------------

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  build(): {
    meta: { name: string };
    lists: Array<{ id: string; record: ListRecord }>;
    cards: Array<{ id: string; record: BoardCardRecord }>;
  };
}

function makeBoardList(id: string, title: string, index: number) {
  return { id, record: { title, index } };
}

function makeBoardCard(
  id: string,
  listId: string,
  index: number,
  title: string,
  extra: Partial<BoardCardRecord> = {},
): { id: string; record: BoardCardRecord } {
  return {
    id,
    record: {
      listId,
      index,
      title,
      description: '',
      labels: [],
      checklist: [],
      ...extra,
    },
  };
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start with just one empty list.',
    build: () => ({
      meta: { name: 'Untitled board' },
      lists: [makeBoardList('list-todo', 'To do', 0)],
      cards: [],
    }),
  },
  {
    id: 'kanban',
    name: 'Kanban (To do / Doing / Done)',
    description: 'The classic three-column setup.',
    build: () => ({
      meta: { name: 'Kanban' },
      lists: [
        makeBoardList('list-todo', 'To do', 0),
        makeBoardList('list-doing', 'Doing', 1024),
        makeBoardList('list-done', 'Done', 2048),
      ],
      cards: [],
    }),
  },
  {
    id: 'sprint',
    name: 'Sprint planning',
    description: 'Backlog → This sprint → In progress → Review → Done.',
    build: () => ({
      meta: { name: 'Sprint' },
      lists: [
        makeBoardList('list-backlog', 'Backlog', 0),
        makeBoardList('list-sprint', 'This sprint', 1024),
        makeBoardList('list-doing', 'In progress', 2048),
        makeBoardList('list-review', 'Review', 3072),
        makeBoardList('list-done', 'Done', 4096),
      ],
      cards: [],
    }),
  },
  {
    id: 'bug-triage',
    name: 'Bug triage',
    description: 'New → Investigating → Confirmed → Fixed → Won\'t fix.',
    build: () => ({
      meta: { name: 'Bug triage' },
      lists: [
        makeBoardList('list-new', 'New', 0),
        makeBoardList('list-invest', 'Investigating', 1024),
        makeBoardList('list-confirmed', 'Confirmed', 2048),
        makeBoardList('list-fixed', 'Fixed', 3072),
        makeBoardList('list-wontfix', "Won't fix", 4096),
      ],
      cards: [
        makeBoardCard('seed-1', 'list-new', 1024, 'Example bug', {
          description: 'A short description of what went wrong.',
          labels: ['#ef4444'],
        }),
      ],
    }),
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'What went well / What could improve / Action items.',
    build: () => ({
      meta: { name: 'Retro' },
      lists: [
        makeBoardList('list-well', 'What went well', 0),
        makeBoardList('list-improve', 'What could improve', 1024),
        makeBoardList('list-actions', 'Action items', 2048),
      ],
      cards: [],
    }),
  },
];

// ---------- Tree templates -------------------------------------------

export interface TreeTemplate {
  id: string;
  name: string;
  description: string;
  build(): {
    meta: { name: string };
    nodes: Array<{ id: string; record: NodeRecord }>;
    edges: Array<{ id: string; record: EdgeRecord }>;
  };
}

function makeTreeNode(
  id: string,
  label: string,
  x: number,
  y: number,
  overrides: Partial<NodeRecord['data']> = {},
): { id: string; record: NodeRecord } {
  return {
    id,
    record: {
      position: { x, y },
      data: {
        label,
        bgColor: '#ffffff',
        textColor: '#1f2937',
        textColorAuto: true,
        borderStyle: 'thin',
        ...overrides,
      },
    },
  };
}

function makeTreeEdge(id: string, source: string, target: string): { id: string; record: EdgeRecord } {
  return { id, record: { source, target, sourceHandle: 'right', targetHandle: 'left' } };
}

export const TREE_TEMPLATES: TreeTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'A single root card to start from.',
    build: () => ({
      meta: { name: 'Untitled tree' },
      nodes: [
        makeTreeNode('root', 'Start here', 80, 200, {
          bgColor: '#1f2937',
          textColor: '#ffffff',
          borderStyle: 'none',
        }),
      ],
      edges: [],
    }),
  },
  {
    id: 'project',
    name: 'Project plan',
    description: 'A root with Research / Design / Build branches.',
    build: () => ({
      meta: { name: 'Project plan' },
      nodes: [
        makeTreeNode('root', 'MY PROJECT', 80, 200, {
          bgColor: '#1f2937',
          textColor: '#ffffff',
          borderStyle: 'none',
        }),
        makeTreeNode('cat-1', 'Research', 360, 96),
        makeTreeNode('cat-2', 'Design', 360, 200),
        makeTreeNode('cat-3', 'Build', 360, 304),
      ],
      edges: [
        makeTreeEdge('e1', 'root', 'cat-1'),
        makeTreeEdge('e2', 'root', 'cat-2'),
        makeTreeEdge('e3', 'root', 'cat-3'),
      ],
    }),
  },
  {
    id: 'org-chart',
    name: 'Org chart',
    description: 'CEO → Engineering / Product / Sales / Operations.',
    build: () => ({
      meta: { name: 'Org chart' },
      nodes: [
        makeTreeNode('ceo', 'CEO', 80, 240, {
          bgColor: '#1f2937',
          textColor: '#ffffff',
          borderStyle: 'none',
        }),
        makeTreeNode('eng', 'Engineering', 360, 96),
        makeTreeNode('prod', 'Product', 360, 192),
        makeTreeNode('sales', 'Sales', 360, 288),
        makeTreeNode('ops', 'Operations', 360, 384),
      ],
      edges: [
        makeTreeEdge('e1', 'ceo', 'eng'),
        makeTreeEdge('e2', 'ceo', 'prod'),
        makeTreeEdge('e3', 'ceo', 'sales'),
        makeTreeEdge('e4', 'ceo', 'ops'),
      ],
    }),
  },
  {
    id: 'decision',
    name: 'Decision tree',
    description: 'Question → Yes/No branches.',
    build: () => ({
      meta: { name: 'Decision' },
      nodes: [
        makeTreeNode('q', 'Should we ship?', 80, 200, {
          bgColor: '#fef3c7',
          borderStyle: 'thick',
        }),
        makeTreeNode('yes', 'Yes — plan release', 360, 96, { bgColor: '#dcfce7' }),
        makeTreeNode('no', 'No — list blockers', 360, 304, { bgColor: '#fee2e2' }),
      ],
      edges: [makeTreeEdge('e1', 'q', 'yes'), makeTreeEdge('e2', 'q', 'no')],
    }),
  },
];

// ---------- Pending-template helpers ---------------------------------

const PENDING_KEY_PREFIX = 'pending-template:';

export function rememberPendingTemplate(slug: string, templateId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_KEY_PREFIX + slug, templateId);
  } catch {
    /* ignore */
  }
}

export function takePendingTemplate(slug: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = window.sessionStorage.getItem(PENDING_KEY_PREFIX + slug);
    if (id) window.sessionStorage.removeItem(PENDING_KEY_PREFIX + slug);
    return id;
  } catch {
    return null;
  }
}
