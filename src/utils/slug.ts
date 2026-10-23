const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateRoomSlug(): string {
  const len = 18;
  const arr = new Uint32Array(len);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 2 ** 32);
  }
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[arr[i] % ALPHABET.length];
  }
  return out;
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9-]{4,64}$/i.test(value);
}

export type Route =
  | { type: 'landing' }
  | { type: 'trees' }
  | { type: 'boards' }
  | { type: 'tree-room'; slug: string }
  | { type: 'board-room'; slug: string };

// The server detects room kind by slug prefix: a document name starting with
// "board-" gets a board seed; anything else gets a tree seed. So a tree slug
// that happens to start with "board-" would seed wrongly (and a board URL with
// a "tree-" prefix would persist that confusing prefix forever). Reject both.
function looksLikeTree(slug: string): boolean {
  const lower = slug.toLowerCase();
  return isValidSlug(slug) && !lower.startsWith('board-');
}
function looksLikeBoard(slug: string): boolean {
  const lower = slug.toLowerCase();
  return isValidSlug(slug) && !lower.startsWith('tree-') && !lower.startsWith('board-');
}

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { type: 'landing' };
  if (pathname === '/trees' || pathname === '/trees/') return { type: 'trees' };
  if (pathname === '/boards' || pathname === '/boards/') return { type: 'boards' };
  const tree = pathname.match(/^\/r\/([^/]+)\/?$/);
  if (tree && looksLikeTree(tree[1])) {
    return { type: 'tree-room', slug: tree[1].toLowerCase() };
  }
  const board = pathname.match(/^\/b\/([^/]+)\/?$/);
  if (board && looksLikeBoard(board[1])) {
    return { type: 'board-room', slug: board[1].toLowerCase() };
  }
  // Unknown / disallowed path: fall back to landing.
  return { type: 'landing' };
}
