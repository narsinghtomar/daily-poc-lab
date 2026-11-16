import { makeSeedPosts } from '../data/seed.ts';
import { createMockFeedApi } from './mockFeedApi.ts';

/**
 * Single API instance for the app. Latency and a small failure rate are on
 * so loading and error states are visible while developing.
 */
export const feedApi = createMockFeedApi({
  posts: makeSeedPosts(120),
  latencyMs: 600,
  failureRate: 0.1,
});
