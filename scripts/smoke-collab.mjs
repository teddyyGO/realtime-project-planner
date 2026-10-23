// Smoke test: open two Hocuspocus connections to (1) a tree room and (2) a
// board room, exercise the sync in each, verify both directions propagate.
// Exits 0 on success, non-zero on failure.

import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { WebSocket as NodeWebSocket } from 'ws';

const BASE = process.env.WS_URL || 'ws://127.0.0.1:3000/collab';
const STAMP = Math.random().toString(36).slice(2, 10);

const failures = [];

function makeProvider(roomName, doc) {
  return new HocuspocusProvider({
    url: BASE,
    name: roomName,
    document: doc,
    WebSocketPolyfill: NodeWebSocket,
  });
}

async function waitForSynced(provider, label) {
  if (provider.isSynced) return;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} sync timeout`)), 8000);
    const handler = (e) => {
      const synced = typeof e === 'boolean' ? e : e?.state ?? true;
      if (synced) {
        clearTimeout(t);
        provider.off('synced', handler);
        resolve();
      }
    };
    provider.on('synced', handler);
  });
}

async function waitFor(predicate, label, ms = 6000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

async function runTreeTest() {
  const room = `tree-smoke-${STAMP}`;
  console.log(`[tree] room=${room}`);

  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const a = makeProvider(room, docA);
  const b = makeProvider(room, docB);

  try {
    await Promise.all([waitForSynced(a, 'A'), waitForSynced(b, 'B')]);

    const nodesA = docA.getMap('nodes');
    const nodesB = docB.getMap('nodes');

    // Seed visibility (tree default seed has root, cat-1..3).
    const seedOk =
      nodesB.has('root') && nodesB.has('cat-1') && nodesB.has('cat-2') && nodesB.has('cat-3');
    if (!seedOk) throw new Error('seed not visible in B');

    // Live propagation A → B.
    const ID = `live-${STAMP}`;
    docA.transact(() => {
      nodesA.set(ID, {
        position: { x: 0, y: 0 },
        data: {
          label: 'Hello from A',
          bgColor: '#ffffff',
          textColor: '#1f2937',
          textColorAuto: true,
          borderStyle: 'thin',
        },
      });
    });
    await waitFor(() => nodesB.get(ID)?.data?.label === 'Hello from A', 'A → B node sync');
    console.log('[tree] PASS');
  } catch (err) {
    failures.push(`tree: ${err.message}`);
  } finally {
    a.destroy();
    b.destroy();
  }
}

async function runBoardTest() {
  // The on-wire room name is the user-visible slug with a `board-` prefix —
  // that's how the server picks the board seed.
  const slug = `smoke-${STAMP}`;
  const room = `board-${slug}`;
  console.log(`[board] room=${room}`);

  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const a = makeProvider(room, docA);
  const b = makeProvider(room, docB);

  try {
    await Promise.all([waitForSynced(a, 'A'), waitForSynced(b, 'B')]);

    const listsA = docA.getMap('lists');
    const cardsA = docA.getMap('cards');
    const listsB = docB.getMap('lists');
    const cardsB = docB.getMap('cards');

    // Seed should give us 3 lists + 1 welcome card.
    const seedOk =
      listsB.has('list-todo') &&
      listsB.has('list-doing') &&
      listsB.has('list-done') &&
      cardsB.has('card-welcome');
    if (!seedOk) throw new Error('board seed not visible in B');

    // Add a list and a card in A; verify B sees them.
    const listId = `list-live-${STAMP}`;
    const cardId = `card-live-${STAMP}`;
    docA.transact(() => {
      listsA.set(listId, { title: 'Review', index: 100 });
      cardsA.set(cardId, {
        listId,
        index: 0,
        title: 'Verify boards work',
        description: '',
        labels: ['#22c55e'],
        checklist: [],
      });
    });
    await waitFor(() => listsB.get(listId)?.title === 'Review', 'A → B list sync');
    await waitFor(() => cardsB.get(cardId)?.title === 'Verify boards work', 'A → B card sync');

    // B moves the card to "Done"; verify A sees the move.
    docB.transact(() => {
      const cur = cardsB.get(cardId);
      cardsB.set(cardId, { ...cur, listId: 'list-done', index: 999 });
    });
    await waitFor(() => cardsA.get(cardId)?.listId === 'list-done', 'B → A move sync');

    console.log('[board] PASS');
  } catch (err) {
    failures.push(`board: ${err.message}`);
  } finally {
    a.destroy();
    b.destroy();
  }
}

(async () => {
  await runTreeTest();
  await runBoardTest();
  if (failures.length === 0) {
    console.log('\nALL PASS');
    setTimeout(() => process.exit(0), 100);
  } else {
    console.error('\nFAILED:', failures.join('; '));
    setTimeout(() => process.exit(1), 100);
  }
})().catch((err) => {
  console.error('FATAL:', err.message);
  setTimeout(() => process.exit(1), 100);
});
