import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockFeedApi, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './mockFeedApi.ts';
import { encodeCursor } from './cursor.ts';
import { FeedApiError, type FeedApi, type Post } from './types.ts';
import { makeSeedPosts } from '../data/seed.ts';

async function drain(api: FeedApi, limit: number): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = await api.fetchFeedPage({ cursor, limit });
    ids.push(...page.items.map((p) => p.id));
    cursor = page.nextCursor;
    pages++;
  } while (cursor && pages < 1000);
  return { ids, pages };
}

test('walks the whole feed exactly once, newest first', async () => {
  const posts = makeSeedPosts(57);
  const api = createMockFeedApi({ posts });
  const { ids, pages } = await drain(api, 10);

  assert.equal(pages, 6);
  assert.equal(ids.length, 57);
  assert.equal(new Set(ids).size, 57);

  const byId = new Map(posts.map((p) => [p.id, p]));
  for (let i = 1; i < ids.length; i++) {
    const prev = byId.get(ids[i - 1])!;
    const cur = byId.get(ids[i])!;
    assert.ok(prev.createdAt >= cur.createdAt, 'not sorted newest first');
  }
});

test('last page has a null cursor, including when size divides evenly', async () => {
  const api = createMockFeedApi({ posts: makeSeedPosts(20) });
  const first = await api.fetchFeedPage({ limit: 10 });
  const second = await api.fetchFeedPage({ cursor: first.nextCursor, limit: 10 });
  assert.equal(second.items.length, 10);
  assert.equal(second.nextCursor, null);
});

test('empty feed returns no items and no cursor', async () => {
  const page = await createMockFeedApi().fetchFeedPage();
  assert.deepEqual(page, { items: [], nextCursor: null });
});

test('new posts at the top do not cause duplicates on the next page', async () => {
  const posts = makeSeedPosts(30);
  const api = createMockFeedApi({ posts });
  const first = await api.fetchFeedPage({ limit: 10 });

  for (let i = 0; i < 5; i++) {
    api.publish({ ...posts[0], id: `new-${i}`, createdAt: `2027-01-0${i + 1}T00:00:00.000Z` });
  }

  const second = await api.fetchFeedPage({ cursor: first.nextCursor, limit: 10 });
  const firstIds = new Set(first.items.map((p) => p.id));
  assert.ok(second.items.every((p) => !firstIds.has(p.id)));
  assert.ok(second.items.every((p) => !p.id.startsWith('new-')));
  assert.equal(second.items[0].id, posts.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[10].id);
});

test('cursor still works if the row it points at was removed', async () => {
  const posts = makeSeedPosts(30);
  const api = createMockFeedApi({ posts });
  const first = await api.fetchFeedPage({ limit: 10 });
  const last = first.items[9];

  const without = createMockFeedApi({ posts: posts.filter((p) => p.id !== last.id) });
  const second = await without.fetchFeedPage({ cursor: encodeCursor(last), limit: 10 });
  assert.equal(second.items.length, 10);
  assert.ok(second.items.every((p) => p.createdAt <= last.createdAt));
});

test('limit is clamped on the server side', async () => {
  const api = createMockFeedApi({ posts: makeSeedPosts(120) });
  assert.equal((await api.fetchFeedPage()).items.length, DEFAULT_PAGE_SIZE);
  assert.equal((await api.fetchFeedPage({ limit: 1000 })).items.length, MAX_PAGE_SIZE);
  assert.equal((await api.fetchFeedPage({ limit: 0 })).items.length, 1);
  assert.equal((await api.fetchFeedPage({ limit: Number.NaN })).items.length, DEFAULT_PAGE_SIZE);
});

test('invalid cursor is rejected with a typed error', async () => {
  const api = createMockFeedApi({ posts: makeSeedPosts(5) });
  await assert.rejects(api.fetchFeedPage({ cursor: 'bogus' }), (err: unknown) => {
    return err instanceof FeedApiError && err.code === 'INVALID_CURSOR';
  });
});

test('injected failures surface as NETWORK errors', async () => {
  const api = createMockFeedApi({ posts: makeSeedPosts(5), failureRate: 0.5, random: () => 0.1 });
  await assert.rejects(api.fetchFeedPage(), (err: unknown) => {
    return err instanceof FeedApiError && err.code === 'NETWORK';
  });
});

test('aborting a slow request rejects with ABORTED', async () => {
  const api = createMockFeedApi({ posts: makeSeedPosts(5), latencyMs: 1000 });
  const controller = new AbortController();
  const pending = api.fetchFeedPage({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (err: unknown) => err instanceof FeedApiError && err.code === 'ABORTED');
});

test('returned posts are copies, so callers cannot mutate the store', async () => {
  const api = createMockFeedApi({ posts: makeSeedPosts(3) });
  const page = await api.fetchFeedPage();
  const mutated: Post = page.items[0];
  mutated.likeCount = -1;
  mutated.author.name = 'changed';
  const again = await api.fetchFeedPage();
  assert.notEqual(again.items[0].likeCount, -1);
  assert.notEqual(again.items[0].author.name, 'changed');
});

test('seed data is deterministic', () => {
  assert.deepEqual(makeSeedPosts(10), makeSeedPosts(10));
});

test('setLike is idempotent and returns the server state', async () => {
  const [post] = makeSeedPosts(1);
  const api = createMockFeedApi({ posts: [{ ...post, likedByMe: false, likeCount: 4 }] });

  assert.deepEqual(await api.setLike({ postId: post.id, liked: true }), { postId: post.id, likedByMe: true, likeCount: 5 });
  assert.deepEqual(await api.setLike({ postId: post.id, liked: true }), { postId: post.id, likedByMe: true, likeCount: 5 });
  assert.deepEqual(await api.setLike({ postId: post.id, liked: false }), { postId: post.id, likedByMe: false, likeCount: 4 });

  const { items } = await api.fetchFeedPage();
  assert.equal(items[0].likeCount, 4, 'feed reflects the stored like state');
});

test('setLike rejects unknown posts and injected failures leave the store untouched', async () => {
  const [post] = makeSeedPosts(1);
  const api = createMockFeedApi({ posts: [{ ...post, likedByMe: false, likeCount: 0 }], likeFailureRate: 1, random: () => 0 });

  await assert.rejects(api.setLike({ postId: post.id, liked: true }), (e) => e instanceof FeedApiError && e.code === 'NETWORK');
  const ok = createMockFeedApi({ posts: [post] });
  await assert.rejects(ok.setLike({ postId: 'missing', liked: true }), (e) => e instanceof FeedApiError && e.code === 'NOT_FOUND');

  const { items } = await api.fetchFeedPage();
  assert.equal(items[0].likedByMe, false, 'a failed call must not write');
  assert.equal(items[0].likeCount, 0);
});
