import { makeSeedPosts } from '../data/seed.ts';
import { createMockFeedApi, type MockFeedApi } from './mockFeedApi.ts';

/**
 * Single API instance for the app. Latency and a small failure rate are on
 * so loading and error states are visible while developing.
 */
export const feedApi = createMockFeedApi({
  posts: makeSeedPosts(120),
  latencyMs: 600,
  failureRate: 0.1,
  // Higher than page loads so the like rollback is easy to see while developing.
  likeFailureRate: 0.2,
});

/**
 * Publishes a new post every `intervalMs`, simulating other users posting
 * while this one scrolls. Returns a stop function (fits a useEffect cleanup).
 */
export function startNewPostTicker(api: MockFeedApi, intervalMs: number, now: () => number = Date.now): () => void {
  let n = 0;
  const timer = setInterval(() => {
    n += 1;
    api.publish({
      id: `live-${now()}-${n}`,
      author: { id: 'u-live', name: 'Live poster' },
      text: `Fresh post #${n}. Pull down to see it.`,
      createdAt: new Date(now()).toISOString(),
      likeCount: 0,
      likedByMe: false,
    });
  }, intervalMs);
  return () => clearInterval(timer);
}
