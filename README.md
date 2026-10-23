# Project Planning

A real-time multi-user web app for project planning, with two ways to think
about a project side-by-side:

- **Tree Maker** — a free-form canvas of connected cards (org-chart / mind-map shape) for designing structure.
- **Boards** — Trello-style kanban columns of cards with labels, checklists, and due dates for tracking progress.

Stack: Vite + React + TypeScript, [React Flow](https://reactflow.dev) (trees),
[@dnd-kit](https://dndkit.com) (boards), Tailwind, [`@dagrejs/dagre`](https://github.com/dagrejs/dagre)
(tree auto-layout), [Yjs](https://yjs.dev) + [Hocuspocus](https://tiptap.dev/docs/hocuspocus)
for real-time sync, and Postgres for persistence.

Every browser that opens the same room URL joins the same live document — edits,
drags, and selections sync instantly between everyone in the room.

## Features

### Shared across both modes

- **Landing chooser at `/`** to pick Tree Maker or Boards
- **Choose-a-nickname** dialog on first visit (random color or pick one); click your own avatar to change later
- Real-time multi-user editing (Figma-style) — Yjs CRDT auto-merges concurrent edits
- Presence avatars + sync status indicator + "Share" copies the URL
- Undo / redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z) — scoped to your own changes
- Per-section dashboard at `/trees` and `/boards`, with switcher tabs to jump between them
- Editable project title at the top of each room

### Tree Maker (`/r/<slug>`)

- Pannable, zoomable infinite canvas with a subtle dot grid (8 px snap)
- Add cards from the toolbar or via right-click → **Add child**
- Double-click a card to edit its label inline
- Drag a card's edge handle (any of the 4 sides) to another card to connect them (orthogonal elbows)
- Backspace / Delete removes the selected card or edge
- Style panel: preset swatches + hex picker, auto-contrast text, border weight
- **Auto-layout** button reorganizes the tree left-to-right with dagre
- Import / export JSON, export SVG and PNG of the current canvas
- "Who's editing this card" outlines + live cursors

### Boards (`/b/<slug>`)

- Add / rename / delete lists and cards; drag cards within and between lists; drag lists to reorder
- Click a card → modal with description, **color labels**, **checklist** (with progress bar), and **due date** (overdue → red chip)
- Card preview shows label chips, checklist progress, due-date chip
- "Someone else has this card open" outlines on cards (no live cursors — Trello doesn't have them)

## URL model

| Path | Behavior |
|---|---|
| `/` | Landing chooser — Tree Maker or Boards |
| `/trees` | Tree dashboard — projects you've visited (from `localStorage`) |
| `/r/<slug>` | A specific tree room. Anyone with the URL can view and edit. |
| `/boards` | Boards dashboard — boards you've visited |
| `/b/<slug>` | A specific board. Anyone with the URL can view and edit. |

Each browser's dashboard lists only the projects it has visited — there is no
server-side "list all rooms" endpoint. Once you've opened a room, the server
returns its current title and `updated_at` via `GET /api/rooms?slugs=...` so
the dashboard stays fresh.

Slugs are 18 random characters from `crypto.getRandomValues`. There are no
accounts — **access control is "unguessable URL" only**: anyone with a room link
can read and edit it. The server only accepts WebSocket document names that look
like room slugs, caps WebSocket frame size, and sends basic security headers
(`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`) so room
URLs don't leak via the `Referer` header.

## Local development

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:5173 (Vite dev server)

# In a second terminal, run the Hocuspocus + Express server:
npm run build && npm start    # http://localhost:3000
```

For local dev, set `DATABASE_URL` to point at a local Postgres if you want
persistence, otherwise the server falls back to **in-memory storage** (state is
lost on server restart, but the canvas works fine for testing).

```powershell
$env:DATABASE_URL = "postgres://user:pass@localhost:5432/planning"
npm start
```

## Production build

```bash
npm run build        # type-checks + builds the React app to dist/
npm start            # serves dist/ + WebSocket sync on $PORT (default 3000)
```

The Express server:
- gzips responses
- serves the built assets with long cache headers
- exposes `/healthz` for healthchecks
- exposes `/api/info` for confirming Postgres is wired (`{ persistence: "postgres" | "memory" }`)
- terminates Yjs WebSocket connections at `/collab` (Hocuspocus handles room dispatch)
- falls back to `index.html` for unmatched routes (SPA fallback)

## Deploy to Railway

This repo ships both a **Dockerfile** and a **`railway.json`** — either path
works.

1. Create a new Railway project from this repo.
2. **Add Postgres**: in the project, click *+ New → Database → Add PostgreSQL*.
   Railway automatically injects `DATABASE_URL` into your service's environment.
3. Railway will detect `railway.json` and run:
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
   - **Healthcheck:** `GET /healthz`
4. Click the service → **Settings** → **Networking** → **Generate Domain**.
5. Open the URL. Pick **Tree Maker** or **Boards** on the landing page, then
   create a project and send the URL to a teammate.

If `DATABASE_URL` is not set, the service still runs but data is lost on
restart. **Always add Postgres for production.**

### Required env vars

| Name           | Required        | Notes |
|----------------|-----------------|-------|
| `PORT`         | No              | Injected by Railway. Local fallback: `3000`. |
| `DATABASE_URL` | Yes (for prod)  | Injected automatically when you attach Railway Postgres. |
| `PGSSLMODE`    | No              | Set to `disable` to force-disable SSL (e.g. local Postgres). |

### Local Docker test

```bash
docker build -t project-planning-tree .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgres://user:pass@host.docker.internal:5432/planning" \
  project-planning-tree
```

WebSockets work out of the box on Railway — no extra configuration needed.

## Architecture

```
┌────────────┐                                    ┌──────────┐
│ Browser A  │◄─── HTTPS (static) ────┐           │          │
│  Y.Doc     │◄═══ WSS  /collab ══════│  Express  │          │
└────────────┘                        │     +     │◄────────►│ Postgres │
┌────────────┐                        │ Hocuspocus│  documents│
│ Browser B  │◄─── HTTPS ─────────────│           │          │ (one row │
│  Y.Doc     │◄═══ WSS ═══════════════│           │          │  per room│
└────────────┘                        └───────────┘          └──────────┘
                                       single Node process
                                       on Railway, one $PORT
```

**Persistence:** Hocuspocus's Database extension serializes the Y.Doc to a
single `BYTEA` row per room, debounced ~1.5s after the last edit.

**Schema:** auto-created on first boot.

```sql
CREATE TABLE documents (
  name        TEXT PRIMARY KEY,        -- the room slug
  title       TEXT,                    -- project title (mirrored from Y.meta.name)
  data        BYTEA NOT NULL,          -- Yjs binary state
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX documents_updated_at_idx ON documents (updated_at DESC);
```

The `title` column is kept in sync by an `afterStoreDocument` extension that
reads `Y.Doc.getMap('meta').get('name')` after each persistence write.

**Slug prefixing:** the on-wire Hocuspocus document name is the user-visible
slug for trees, but `board-<slug>` for boards. That prefix tells the server
which seed to apply for a fresh room. Legacy unprefixed slugs are treated as
trees for backward compatibility with rooms created before boards existed.

**Conflict resolution:** Yjs is a CRDT. Two people editing different items
simultaneously is conflict-free. Two people editing the **same card's title or
description** at the same instant — last-write-wins (whole-string fields). Two
people moving the same kanban card simultaneously — last move wins. Drag
ordering uses sparse float indices (Trello's classic model) with a tiny per-write
jitter so concurrent inserts at the same gap don't collide on a byte-identical
value.

**Known limitation — whole-record LWW for board cards.** A board card is stored
as a single Y.Map value (plain JS object). Two truly concurrent updates to
*different* fields of the *same* card (e.g. user A toggles a label while user
B edits the title in the modal) resolve last-writer-wins for the whole record,
so one of the two writes is dropped. Single-field mutators (`toggleLabel`,
`addChecklistItem`, etc.) read fresh inside the transaction to avoid stale-snapshot
clobbering, and the card detail modal now uses a dirty-flag pattern so it only
writes back fields the user actually edited. The proper fix is to model each
card as a nested Y.Map with `Y.Text`/`Y.Array` field-CRDTs so independent fields
merge independently — that's a non-trivial refactor planned for v2.

**Orphan rescue.** If user A deletes a list while user B concurrently moves or
adds a card *into* that list, Yjs merges both ops and the card would otherwise
be invisible (its `listId` points at a deleted list). The board rebuild pass
schedules a one-shot transaction that reparents orphan cards to the first
surviving list — data is preserved, never silently lost.

**Boards Y.Doc shape** (mirrors the tree shape, different maps):

```
meta:  Y.Map<{ name: string }>
lists: Y.Map<{ title: string, index: number }>
cards: Y.Map<{ listId, index, title, description, labels[], checklist[], dueDate? }>
```

## Project layout

```
.
├── Dockerfile           # multi-stage Node 20 Alpine
├── railway.json         # Nixpacks build + healthcheck config
├── server.js            # Express + Hocuspocus + Postgres extension
├── scripts/smoke-collab.mjs  # two-client sync smoke test against a running server
├── src/
│   ├── App.tsx          # canvas + room wiring
│   ├── collab/          # Y.Doc room, useYGraph, awareness, cursors, presence
│   ├── components/      # CardNode, Toolbar, StylePanel, ContextMenu
│   └── utils/           # layout (dagre), export, contrast, slug, userIdentity
└── vite.config.ts
```

## Future upgrades worth considering

- **Auth** (so only your team can join rooms): Hocuspocus has `onAuthenticate`
  hooks; add a sign-in flow and pass a token via `WebsocketProvider` params.
- **`y-indexeddb`** for true offline-first.
- **Character-level label merge** via `Y.Text` per node.
- **Soft delete / version history** — Yjs stores enough info to restore older
  states; Hocuspocus has a snapshot extension.

## License

MIT
