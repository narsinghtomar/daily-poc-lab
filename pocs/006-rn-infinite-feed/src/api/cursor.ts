/**
 * Keyset cursor: the sort key (createdAt, id) of the last item on a page.
 *
 * Offset pagination breaks when new posts land at the top of the feed: every
 * row shifts down and the next page repeats items. A keyset cursor says
 * "give me what comes after this exact row", so inserts above it are harmless.
 *
 * The token is base64url so clients treat it as opaque and do not build it.
 */
export type CursorKey = {
  createdAt: string;
  id: string;
};

const VERSION = 'v1';
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

export function encodeCursor(key: CursorKey): string {
  return toBase64Url(JSON.stringify([VERSION, key.createdAt, key.id]));
}

/** Returns null for anything that is not a cursor this server issued. */
export function decodeCursor(token: string): CursorKey | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > 256) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(token));
    if (!Array.isArray(parsed) || parsed.length !== 3) return null;
    const [version, createdAt, id] = parsed;
    if (version !== VERSION) return null;
    if (typeof createdAt !== 'string' || !ISO_UTC.test(createdAt)) return null;
    if (typeof id !== 'string' || id.length === 0) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Feed order: newest first, id as a tie-breaker so the order is total. */
export function compareFeedOrder(a: CursorKey, b: CursorKey): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}
