import { compareFeedOrder, decodeCursor, encodeCursor } from './cursor.ts';
import { FeedApiError, type FeedApi, type FeedPage, type FetchFeedParams, type Post } from './types.ts';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export type MockFeedApiOptions = {
  posts?: Post[];
  /** Simulated round trip. Keep 0 in tests. */
  latencyMs?: number;
  /** Probability (0..1) that a request fails with a NETWORK error. */
  failureRate?: number;
  /** Injected so failure behaviour is deterministic in tests. */
  random?: () => number;
};

export type MockFeedApi = FeedApi & {
  /** Simulates someone posting while the user is scrolling. */
  publish(post: Post): void;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new FeedApiError('ABORTED', 'Request aborted'));
    if (ms <= 0) return resolve();
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new FeedApiError('ABORTED', 'Request aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(limit)));
}

const clonePost = (p: Post): Post => ({ ...p, author: { ...p.author } });

/**
 * In-memory stand-in for GET /feed?cursor=&limit=.
 * Behaves like a real keyset-paginated endpoint: stable order, opaque cursor,
 * limit clamped server side, and returns copies so callers cannot mutate the store.
 */
export function createMockFeedApi(options: MockFeedApiOptions = {}): MockFeedApi {
  const { latencyMs = 0, failureRate = 0, random = Math.random } = options;
  const store: Post[] = (options.posts ?? []).map(clonePost).sort(compareFeedOrder);

  return {
    async fetchFeedPage(params: FetchFeedParams = {}): Promise<FeedPage> {
      const { cursor, signal } = params;
      const limit = clampLimit(params.limit);

      await sleep(latencyMs, signal);
      if (failureRate > 0 && random() < failureRate) {
        throw new FeedApiError('NETWORK', 'Simulated network failure');
      }

      let start = 0;
      if (cursor) {
        const key = decodeCursor(cursor);
        if (!key) throw new FeedApiError('INVALID_CURSOR', 'Cursor is malformed or expired');
        // First row strictly after the cursor in feed order. The cursor row itself
        // may have been deleted, so search by key instead of by id.
        start = store.findIndex((p) => compareFeedOrder(p, key) > 0);
        if (start === -1) start = store.length;
      }

      // Read one extra row to know whether another page exists without a COUNT query.
      const slice = store.slice(start, start + limit + 1);
      const hasMore = slice.length > limit;
      const items = slice.slice(0, limit).map(clonePost);
      const last = items[items.length - 1];

      return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
    },

    publish(post: Post) {
      store.push(clonePost(post));
      store.sort(compareFeedOrder);
    },
  };
}
