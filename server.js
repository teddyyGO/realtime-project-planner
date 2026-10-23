import express from 'express';
import expressWs from 'express-ws';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import pg from 'pg';
import * as Y from 'yjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT) || 3000;
const distDir = path.join(__dirname, 'dist');
const databaseUrl = process.env.DATABASE_URL ?? '';

// --- Postgres pool (optional) ---------------------------------------------
const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: needsSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 4,
    })
  : null;

function needsSsl(url) {
  if (process.env.PGSSLMODE === 'disable') return false;
  return !/(?:localhost|127\.0\.0\.1)/.test(url);
}

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      name        TEXT PRIMARY KEY,
      data        BYTEA NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Idempotent migration: project title column for the dashboard.
  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS title TEXT;`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents (updated_at DESC);`,
  );
}

// --- Seeds --------------------------------------------------------------
// Slug prefix tells us which seed to apply for a brand-new room:
//   "tree-…"   → tree (React Flow canvas)
//   "board-…"  → board (kanban)
//   anything else (legacy) → tree
function detectKind(documentName) {
  if (typeof documentName !== 'string') return 'tree';
  if (documentName.startsWith('board-')) return 'board';
  if (documentName.startsWith('tree-')) return 'tree';
  return 'tree';
}

function buildSeedUpdate(documentName) {
  return detectKind(documentName) === 'board' ? buildBoardSeedUpdate() : buildTreeSeedUpdate();
}

function buildTreeSeedUpdate() {
  const doc = new Y.Doc();
  const nodes = doc.getMap('nodes');
  const edges = doc.getMap('edges');
  const meta = doc.getMap('meta');

  doc.transact(() => {
    meta.set('name', 'Untitled project');
    nodes.set('root', {
      position: { x: 80, y: 200 },
      data: {
        label: 'MY PROJECT',
        bgColor: '#1f2937',
        textColor: '#ffffff',
        textColorAuto: true,
        borderStyle: 'none',
      },
    });
    nodes.set('cat-1', {
      position: { x: 360, y: 96 },
      data: {
        label: 'Research',
        bgColor: '#ffffff',
        textColor: '#1f2937',
        textColorAuto: true,
        borderStyle: 'thin',
      },
    });
    nodes.set('cat-2', {
      position: { x: 360, y: 200 },
      data: {
        label: 'Design',
        bgColor: '#ffffff',
        textColor: '#1f2937',
        textColorAuto: true,
        borderStyle: 'thin',
      },
    });
    nodes.set('cat-3', {
      position: { x: 360, y: 304 },
      data: {
        label: 'Build',
        bgColor: '#ffffff',
        textColor: '#1f2937',
        textColorAuto: true,
        borderStyle: 'thin',
      },
    });

    edges.set('e-root-cat1', { source: 'root', target: 'cat-1' });
    edges.set('e-root-cat2', { source: 'root', target: 'cat-2' });
    edges.set('e-root-cat3', { source: 'root', target: 'cat-3' });
  });

  return Y.encodeStateAsUpdate(doc);
}

function buildBoardSeedUpdate() {
  const doc = new Y.Doc();
  const meta = doc.getMap('meta');
  const lists = doc.getMap('lists');
  const cards = doc.getMap('cards');

  doc.transact(() => {
    meta.set('name', 'Untitled board');
    lists.set('list-todo', { title: 'To do', index: 0 });
    lists.set('list-doing', { title: 'Doing', index: 1 });
    lists.set('list-done', { title: 'Done', index: 2 });

    cards.set('card-welcome', {
      listId: 'list-todo',
      index: 0,
      title: 'Welcome to your board',
      description: 'Click a card to add details. Drag cards between lists.',
      labels: [],
      checklist: [],
    });
  });

  return Y.encodeStateAsUpdate(doc);
}

// --- Hocuspocus -----------------------------------------------------------
const extensions = [];

if (pool) {
  extensions.push(
    new Database({
      fetch: async ({ documentName }) => {
        const { rows } = await pool.query(
          'SELECT data FROM documents WHERE name = $1',
          [documentName],
        );
        if (rows.length === 0) return buildSeedUpdate(documentName);
        const buf = rows[0].data;
        return buf instanceof Uint8Array ? new Uint8Array(buf) : new Uint8Array(Buffer.from(buf));
      },
      store: async ({ documentName, state }) => {
        await pool.query(
          `INSERT INTO documents (name, data, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          [documentName, Buffer.from(state)],
        );
      },
    }),
  );

  // Mirror meta.name from the Y.Doc into the `title` column so the dashboard
  // can list projects without decoding the BYTEA blob on each request.
  extensions.push({
    async afterStoreDocument({ documentName, document }) {
      try {
        const title = document.getMap('meta').get('name');
        const value = typeof title === 'string' && title.trim() ? title.trim() : null;
        await pool.query('UPDATE documents SET title = $2 WHERE name = $1', [
          documentName,
          value,
        ]);
      } catch (err) {
        console.error('[afterStoreDocument] title sync failed:', err);
      }
    },
  });
} else {
  // In-memory fallback: seed every fresh document so the canvas isn't empty in local dev.
  extensions.push({
    async onLoadDocument({ documentName, document }) {
      if (document.share.size === 0) {
        Y.applyUpdate(document, buildSeedUpdate(documentName));
      }
      return document;
    },
  });
}

// Reject document names that aren't valid room slugs ("<slug>" or "board-<slug>")
// so clients can't create arbitrary rows in the documents table.
const DOC_NAME_RE = /^[a-z0-9-]{4,70}$/i;
extensions.push({
  async onConnect({ documentName }) {
    if (typeof documentName !== 'string' || !DOC_NAME_RE.test(documentName)) {
      throw new Error('invalid document name');
    }
  },
});

const hocuspocus = Hocuspocus.configure({
  name: 'project-planning-tree',
  timeout: 30000,
  debounce: 1500,
  maxDebounce: 8000,
  extensions,
});

// --- Express --------------------------------------------------------------
// Cap WebSocket frames (ws default is 100 MiB) so one client can't exhaust memory.
const { app } = expressWs(express(), undefined, { wsOptions: { maxPayload: 4 * 1024 * 1024 } });

app.disable('x-powered-by');
app.use(compression());
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.get('/healthz', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

// Echo whether Postgres is wired up — handy when debugging deploys.
app.get('/api/info', (_req, res) => {
  res.json({ collab: true, persistence: pool ? 'postgres' : 'memory' });
});

// Bulk metadata lookup for the dashboard. Takes ?slugs=a,b,c (the slugs the
// browser has visited, sent from localStorage). Returns one row per existing
// project. Slugs the user has never visited stay private — there is no
// "list all rooms" endpoint.
const SLUG_RE = /^[a-z0-9-]{4,64}$/i;
app.get('/api/rooms', async (req, res) => {
  if (!pool) {
    res.json([]);
    return;
  }
  const raw = String(req.query.slugs || '');
  const slugs = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => SLUG_RE.test(s));
  if (slugs.length === 0) {
    res.json([]);
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT name AS slug, title, updated_at
       FROM documents
       WHERE name = ANY($1)
       ORDER BY updated_at DESC`,
      [slugs.slice(0, 200)],
    );
    res.json(
      rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
      })),
    );
  } catch (err) {
    console.error('[GET /api/rooms]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// @hocuspocus/provider negotiates the document name inside the WS protocol —
// it does NOT append the room to the URL path. So we mount at a single endpoint.
app.ws('/collab', (websocket, request) => {
  hocuspocus.handleConnection(websocket, request, {});
});

app.use(
  express.static(distDir, {
    maxAge: '1y',
    etag: true,
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  // Don't swallow unknown API paths into the SPA — return JSON 404 so client
  // fetch() error handling works.
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next(err);
  });
});

// --- Boot -----------------------------------------------------------------
ensureSchema()
  .catch((err) => {
    console.error('[boot] schema init failed:', err);
    process.exit(1);
  })
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(
        `Project Planning Tree listening on port ${port} (persistence: ${pool ? 'postgres' : 'memory'})`,
      );
    });
  });
