import { useCallback, useEffect, useReducer, useRef } from 'react';
import { FeedApiError, type FeedApi, type LikeState } from '../api/types.ts';
import { canLoadMore, feedReducer, initialFeedState, type FeedState, type LoadKind } from './feedReducer.ts';

export type UseFeed = FeedState & {
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
  /** Writes a server-confirmed like into the list. */
  confirmLike: (like: LikeState) => void;
};

/**
 * Drives the feed reducer against a FeedApi.
 *
 * Only one request runs at a time. `loadMore` is a no-op while anything is in
 * flight (FlashList can call onEndReached several times in a row). `refresh`
 * wins over a pending page: it aborts it, and the reducer drops the late response.
 */
export function useFeed(api: FeedApi, pageSize = 20): UseFeed {
  const [state, dispatch] = useReducer(feedReducer, initialFeedState);

  // Refs give the callbacks the latest values without re-creating them,
  // and close the gap between dispatch and the next render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlight = useRef<{ kind: LoadKind; controller: AbortController } | null>(null);
  const seq = useRef(0);

  const run = useCallback(
    async (kind: LoadKind, isRetry = false) => {
      const current = stateRef.current;
      if (kind === 'more') {
        if (inFlight.current) return;
        // An explicit retry may follow a failed page; scroll-driven calls may not.
        const allowed = isRetry ? current.hasMore && current.nextCursor !== null : canLoadMore(current);
        if (!allowed) return;
      }
      if (kind !== 'more' && inFlight.current?.kind === kind) return;

      inFlight.current?.controller.abort();
      const controller = new AbortController();
      const request = { kind, controller };
      inFlight.current = request;
      const requestId = ++seq.current;
      dispatch({ type: 'request', kind, requestId });

      try {
        const page = await api.fetchFeedPage({
          cursor: kind === 'more' ? current.nextCursor : null,
          limit: pageSize,
          signal: controller.signal,
        });
        dispatch({ type: 'success', kind, requestId, page });
      } catch (err) {
        if (controller.signal.aborted) return;
        const code = err instanceof FeedApiError ? err.code : 'NETWORK';
        dispatch({ type: 'failure', kind, requestId, code });
      } finally {
        if (inFlight.current === request) inFlight.current = null;
      }
    },
    [api, pageSize],
  );

  useEffect(() => {
    run('initial');
    return () => {
      inFlight.current?.controller.abort();
      inFlight.current = null;
    };
  }, [run]);

  // A cursor the server no longer accepts cannot be retried; start over from the top.
  useEffect(() => {
    if (state.error?.kind === 'more' && state.error.code === 'INVALID_CURSOR') run('refresh');
  }, [state.error, run]);

  const loadMore = useCallback(() => void run('more'), [run]);
  const refresh = useCallback(() => void run(stateRef.current.items.length ? 'refresh' : 'initial'), [run]);
  const retry = useCallback(() => {
    if (stateRef.current.error?.kind === 'more') {
      void run('more', true);
    } else {
      void run(stateRef.current.items.length ? 'refresh' : 'initial');
    }
  }, [run]);

  const confirmLike = useCallback((like: LikeState) => dispatch({ type: 'likeConfirmed', like }), []);

  return { ...state, loadMore, refresh, retry, confirmLike };
}
