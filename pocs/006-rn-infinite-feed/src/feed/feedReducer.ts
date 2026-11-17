import type { FeedApiErrorCode, FeedPage, Post } from '../api/types.ts';

/**
 * Pagination state for the feed, kept free of React so it can be unit tested.
 *
 * - `initial`: first load, list is empty and shows a full-screen spinner
 * - `more`: next page via the cursor, appended at the bottom
 * - `refresh`: pull to refresh, replaces the list with a fresh first page
 */
export type LoadKind = 'initial' | 'more' | 'refresh';

export type FeedState = {
  items: Post[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Which request is in flight, or null when idle. */
  loading: LoadKind | null;
  /** Last failure, kept until the next request of any kind starts. */
  error: { kind: LoadKind; code: FeedApiErrorCode } | null;
  /** Id of the latest request. Responses carrying any other id are stale and dropped. */
  requestId: number;
};

export type FeedAction =
  | { type: 'request'; kind: LoadKind; requestId: number }
  | { type: 'success'; kind: LoadKind; requestId: number; page: FeedPage }
  | { type: 'failure'; kind: LoadKind; requestId: number; code: FeedApiErrorCode };

export const initialFeedState: FeedState = {
  items: [],
  nextCursor: null,
  hasMore: true,
  loading: null,
  error: null,
  requestId: 0,
};

/** Appends a page, skipping ids already on screen so a row never renders twice. */
export function appendUnique(existing: Post[], incoming: Post[]): Post[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((p) => p.id));
  const fresh = incoming.filter((p) => !seen.has(p.id));
  return fresh.length === 0 ? existing : [...existing, ...fresh];
}

/** True when scrolling to the end should fetch: idle, more pages exist, and the last page did not fail. */
export function canLoadMore(state: FeedState): boolean {
  return (
    state.loading === null &&
    state.hasMore &&
    state.nextCursor !== null &&
    state.error?.kind !== 'more'
  );
}

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'request':
      return { ...state, loading: action.kind, error: null, requestId: action.requestId };

    case 'success': {
      if (action.requestId !== state.requestId) return state;
      const { items, nextCursor } = action.page;
      return {
        ...state,
        items: action.kind === 'more' ? appendUnique(state.items, items) : items,
        nextCursor,
        hasMore: nextCursor !== null,
        loading: null,
        error: null,
      };
    }

    case 'failure':
      if (action.requestId !== state.requestId) return state;
      // Keep whatever is already on screen; a failed refresh should not blank the feed.
      return { ...state, loading: null, error: { kind: action.kind, code: action.code } };
  }
}
