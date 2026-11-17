import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { startNewPostTicker } from './client.ts';
import { createMockFeedApi } from './mockFeedApi.ts';
import { makeSeedPosts } from '../data/seed.ts';

test('ticker publishes newest-first posts until stopped', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const api = createMockFeedApi({ posts: makeSeedPosts(5) });
    let clock = Date.UTC(2026, 11, 1);
    const stop = startNewPostTicker(api, 1000, () => (clock += 1000));

    mock.timers.tick(2000);
    stop();
    mock.timers.tick(5000);

    const { items } = await api.fetchFeedPage({ limit: 10 });
    assert.equal(items.length, 7);
    assert.ok(items[0].id.startsWith('live-') && items[0].text.includes('#2'));
    assert.ok(items[1].id.startsWith('live-') && items[1].text.includes('#1'));
  } finally {
    mock.timers.reset();
  }
});
