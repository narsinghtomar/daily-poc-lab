import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendUnique, canLoadMore, feedReducer, initialFeedState, type FeedState } from './feedReducer.ts';
import { makeSeedPosts } from '../data/seed.ts';

const posts = makeSeedPosts(30);
const page = (from: number, to: number, nextCursor: string | null) => ({ items: posts.slice(from, to), nextCursor });

function loaded(): FeedState {
  let s = feedReducer(initialFeedState, { type: 'request', kind: 'initial', requestId: 1 });
  s = feedReducer(s, { type: 'success', kind: 'initial', requestId: 1, page: page(0, 10, 'c1') });
  return s;
}

test('initial load fills the list and stores the cursor', () => {
  const s = loaded();
  assert.equal(s.items.length, 10);
  assert.equal(s.nextCursor, 'c1');
  assert.equal(s.hasMore, true);
  assert.equal(s.loading, null);
  assert.ok(canLoadMore(s));
});

test('loading more appends the next page in order', () => {
  let s = feedReducer(loaded(), { type: 'request', kind: 'more', requestId: 2 });
  assert.equal(s.loading, 'more');
  assert.equal(canLoadMore(s), false, 'must not fire a second page request while one is in flight');
  s = feedReducer(s, { type: 'success', kind: 'more', requestId: 2, page: page(10, 20, 'c2') });
  assert.deepEqual(
    s.items.map((p) => p.id),
    posts.slice(0, 20).map((p) => p.id),
  );
  assert.equal(s.nextCursor, 'c2');
});

test('a null cursor marks the end of the feed', () => {
  let s = feedReducer(loaded(), { type: 'request', kind: 'more', requestId: 2 });
  s = feedReducer(s, { type: 'success', kind: 'more', requestId: 2, page: page(10, 15, null) });
  assert.equal(s.hasMore, false);
  assert.equal(canLoadMore(s), false);
});

test('duplicate ids across pages are rendered once', () => {
  let s = feedReducer(loaded(), { type: 'request', kind: 'more', requestId: 2 });
  s = feedReducer(s, { type: 'success', kind: 'more', requestId: 2, page: page(8, 18, 'c2') });
  assert.equal(s.items.length, 18);
  assert.equal(new Set(s.items.map((p) => p.id)).size, 18);
});

test('refresh replaces the list with the newest first page', () => {
  let s = feedReducer(loaded(), { type: 'request', kind: 'more', requestId: 2 });
  s = feedReducer(s, { type: 'success', kind: 'more', requestId: 2, page: page(10, 20, 'c2') });
  s = feedReducer(s, { type: 'request', kind: 'refresh', requestId: 3 });
  assert.equal(s.items.length, 20, 'old items stay visible while refreshing');
  s = feedReducer(s, { type: 'success', kind: 'refresh', requestId: 3, page: page(0, 10, 'fresh') });
  assert.equal(s.items.length, 10);
  assert.equal(s.nextCursor, 'fresh');
});

test('a page that lands after a refresh started is ignored', () => {
  let s = feedReducer(loaded(), { type: 'request', kind: 'more', requestId: 2 });
  s = feedReducer(s, { type: 'request', kind: 'refresh', requestId: 3 });
  s = feedReducer(s, { type: 'success', kind: 'more', requestId: 2, page: page(10, 20, 'stale') });
  assert.equal(s.items.length, 10);
  assert.equal(s.loading, 'refresh');
  assert.equal(s.nextCursor, 'c1');
});

test('a failed refresh keeps the current items and reports the error', () => {
  let s = feedReducer(loaded(), { type: 'request', kind: 'refresh', requestId: 2 });
  s = feedReducer(s, { type: 'failure', kind: 'refresh', requestId: 2, code: 'NETWORK' });
  assert.equal(s.items.length, 10);
  assert.equal(s.loading, null);
  assert.deepEqual(s.error, { kind: 'refresh', code: 'NETWORK' });
  assert.ok(canLoadMore(s), 'a refresh failure should not block paging');
});

test('a failed page stops auto paging until the next request', () => {
  let s = feedReducer(loaded(), { type: 'request', kind: 'more', requestId: 2 });
  s = feedReducer(s, { type: 'failure', kind: 'more', requestId: 2, code: 'NETWORK' });
  assert.equal(canLoadMore(s), false, 'onEndReached must not retry in a tight loop');
  s = feedReducer(s, { type: 'request', kind: 'more', requestId: 3 });
  assert.equal(s.error, null);
});

test('appendUnique returns the same array when nothing is new', () => {
  const existing = posts.slice(0, 5);
  assert.equal(appendUnique(existing, []), existing);
  assert.equal(appendUnique(existing, posts.slice(0, 3)), existing);
});

test('likeConfirmed patches one row and keeps the others by reference', () => {
  const s = loaded();
  const target = s.items[3];
  const next = feedReducer(s, {
    type: 'likeConfirmed',
    like: { postId: target.id, likedByMe: !target.likedByMe, likeCount: target.likeCount + 7 },
  });
  assert.equal(next.items[3].likedByMe, !target.likedByMe);
  assert.equal(next.items[3].likeCount, target.likeCount + 7);
  assert.equal(target.likeCount, s.items[3].likeCount, 'previous state is not mutated');
  next.items.forEach((p, i) => i !== 3 && assert.equal(p, s.items[i]));
});

test('likeConfirmed is a no-op for unknown posts or unchanged state', () => {
  const s = loaded();
  const p = s.items[0];
  assert.equal(feedReducer(s, { type: 'likeConfirmed', like: { postId: 'gone', likedByMe: true, likeCount: 1 } }), s);
  assert.equal(feedReducer(s, { type: 'likeConfirmed', like: { postId: p.id, likedByMe: p.likedByMe, likeCount: p.likeCount } }), s);
});
