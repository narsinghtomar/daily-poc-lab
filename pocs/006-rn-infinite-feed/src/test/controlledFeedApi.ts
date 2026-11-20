import { createMockFeedApi } from '../api/mockFeedApi.ts';
import {
  FeedApiError,
  type FeedApi,
  type FeedApiErrorCode,
  type FeedPage,
  type FetchFeedParams,
  type LikeState,
  type Post,
  type SetLikeParams,
} from '../api/types.ts';

type Pending<P, R> = {
  params: P;
  /** Answers the call with what the real mock server would return. */
  resolve: () => Promise<void>;
  /** Fails the call with a typed API error. */
  reject: (code?: FeedApiErrorCode) => Promise<void>;
  settled: boolean;
};

/**
 * A FeedApi whose calls stay pending until the test answers them, in any order.
 *
 * Data comes from the real in-memory mock server, so cursors, paging and like
 * counts behave exactly as in the app; only the timing is in the test's hands.
 * Aborted calls reject on their own, like `fetch` does, unless `honorAbort` is
 * false, which models a client that cannot cancel and gets a late answer.
 */
export function createControlledFeedApi(posts: Post[], { honorAbort = true } = {}) {
  const server = createMockFeedApi({ posts });
  const pages: Pending<FetchFeedParams, FeedPage>[] = [];
  const likes: Pending<SetLikeParams, LikeState>[] = [];

  function hold<P, R>(queue: Pending<P, R>[], params: P, answer: () => Promise<R>, signal?: AbortSignal): Promise<R> {
    return new Promise<R>((res, rej) => {
      const call: Pending<P, R> = {
        params,
        settled: false,
        resolve: async () => {
          call.settled = true;
          try {
            res(await answer());
          } catch (err) {
            rej(err);
          }
        },
        reject: async (code = 'NETWORK') => {
          call.settled = true;
          rej(new FeedApiError(code, `Test failure: ${code}`));
        },
      };
      const onAbort = () => {
        if (call.settled) return;
        call.settled = true;
        rej(new FeedApiError('ABORTED', 'Request aborted'));
      };
      if (honorAbort) signal?.addEventListener('abort', onAbort, { once: true });
      queue.push(call);
    });
  }

  const api: FeedApi = {
    fetchFeedPage: (params = {}) =>
      hold(pages, params, () => server.fetchFeedPage({ cursor: params.cursor, limit: params.limit }), params.signal),
    setLike: (params) => hold(likes, params, () => server.setLike({ postId: params.postId, liked: params.liked })),
  };

  return {
    api,
    server,
    pages,
    likes,
    /** The oldest call nobody has answered yet. */
    nextPage: () => pages.find((c) => !c.settled),
    nextLike: () => likes.find((c) => !c.settled),
  };
}
