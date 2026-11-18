import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import {
  applyPendingLikes,
  LIKE_MUTATION_KEY,
  likeMutationOptions,
  type LikeMutationDeps,
  type LikeVars,
} from './likeMutation.ts';
import { feedReducer, initialFeedState, type FeedState } from '../feed/feedReducer.ts';
import { FeedApiError, type LikeState, type Post, type SetLikeParams } from '../api/types.ts';
import { makeSeedPosts } from '../data/seed.ts';

const post = (id: string, likedByMe: boolean, likeCount: number): Post => ({
  ...makeSeedPosts(1)[0],
  id,
  likedByMe,
  likeCount,
});

test('applyPendingLikes shows the latest intent and keeps untouched rows by reference', () => {
  const items = [post('a', false, 3), post('b', true, 1), post('c', false, 0)];
  const out = applyPendingLikes(items, [
    { postId: 'a', liked: true },
    { postId: 'b', liked: false },
    { postId: 'a', liked: false }, // second tap on a: back to unliked
  ]);
  assert.equal(out[0], items[0], 'a ends where the server already is, so no new object');
  assert.deepEqual([out[1].likedByMe, out[1].likeCount], [false, 0]);
  assert.equal(out[2], items[2]);
});

test('applyPendingLikes returns the same array when nothing changes', () => {
  const items = [post('a', true, 2)];
  assert.equal(applyPendingLikes(items, []), items);
  assert.equal(applyPendingLikes(items, [{ postId: 'a', liked: true }, undefined]), items);
  assert.equal(applyPendingLikes(items, [{ postId: 'zzz', liked: true }]), items);
});

test('applyPendingLikes never shows a negative count', () => {
  const [out] = applyPendingLikes([post('a', true, 0)], [{ postId: 'a', liked: false }]);
  assert.equal(out.likeCount, 0);
});

/** A setLike whose calls are resolved or rejected by hand, in any order. */
function controlledApi(server: Map<string, LikeState>) {
  const calls: { params: SetLikeParams; resolve: () => void; reject: () => void }[] = [];
  return {
    calls,
    api: {
      setLike: (params: SetLikeParams) =>
        new Promise<LikeState>((res, rej) => {
          calls.push({
            params,
            resolve: () => {
              const cur = server.get(params.postId)!;
              const next =
                cur.likedByMe === params.liked
                  ? cur
                  : { ...cur, likedByMe: params.liked, likeCount: cur.likeCount + (params.liked ? 1 : -1) };
              server.set(params.postId, next);
              res(next);
            },
            reject: () => rej(new FeedApiError('NETWORK', 'offline')),
          });
        }),
    },
  };
}

/** Wires the real mutation options to a QueryClient and the feed reducer, the way FeedScreen does. */
function harness(initial: Post[]) {
  const client = new QueryClient();
  const server = new Map(initial.map((p) => [p.id, { postId: p.id, likedByMe: p.likedByMe, likeCount: p.likeCount }]));
  const { api, calls } = controlledApi(server);
  let state: FeedState = feedReducer(
    feedReducer(initialFeedState, { type: 'request', kind: 'initial', requestId: 1 }),
    { type: 'success', kind: 'initial', requestId: 1, page: { items: initial, nextCursor: null } },
  );
  const failures: LikeVars[] = [];
  const deps: LikeMutationDeps = {
    api,
    onConfirmed: (like) => (state = feedReducer(state, { type: 'likeConfirmed', like })),
    onFailed: (vars) => failures.push(vars),
  };
  const displayed = () => {
    const pending = client
      .getMutationCache()
      .findAll({ mutationKey: [...LIKE_MUTATION_KEY], status: 'pending' })
      .map((m) => m.state.variables as LikeVars);
    return applyPendingLikes(state.items, pending);
  };
  const row = (id: string) => displayed().find((p) => p.id === id)!;
  /** Taps the like button on the row as currently displayed. */
  const tap = (id: string) => {
    const observer = new MutationObserver(client, likeMutationOptions(deps, id));
    return observer.mutate({ postId: id, liked: !row(id).likedByMe }).catch(() => undefined);
  };
  return { calls, server, failures, row, tap, settle: () => new Promise((r) => setTimeout(r, 0)) };
}

test('like shows instantly and is kept with the server count on success', async () => {
  const h = harness([post('a', false, 10)]);
  const done = h.tap('a');
  await h.settle();
  assert.deepEqual([h.row('a').likedByMe, h.row('a').likeCount], [true, 11], 'optimistic before the server answers');

  h.calls[0].resolve();
  await done;
  assert.deepEqual([h.row('a').likedByMe, h.row('a').likeCount], [true, 11]);
});

test('a failed like rolls back to the last confirmed state and reports the failure', async () => {
  const h = harness([post('a', false, 10)]);
  const done = h.tap('a');
  await h.settle();
  assert.equal(h.row('a').likedByMe, true);

  h.calls[0].reject();
  await done;
  assert.deepEqual([h.row('a').likedByMe, h.row('a').likeCount], [false, 10]);
  assert.deepEqual(h.failures, [{ postId: 'a', liked: true }]);
});

test('calls for one post run one at a time, in tap order', async () => {
  const h = harness([post('a', false, 10), post('b', false, 0)]);
  const t1 = h.tap('a');
  const t2 = h.tap('a'); // unlike before the like has answered
  const t3 = h.tap('b');
  await h.settle();

  assert.deepEqual(
    h.calls.map((c) => c.params.postId),
    ['a', 'b'],
    'second call for a waits; b is not blocked',
  );
  assert.deepEqual([h.row('a').likedByMe, h.row('a').likeCount], [false, 10], 'shows the latest tap');

  h.calls[0].resolve();
  await t1;
  await h.settle();
  assert.equal(h.calls.length, 3);
  assert.deepEqual(h.calls[2].params, { postId: 'a', liked: false });
  assert.equal(h.row('a').likedByMe, false, 'confirmed like does not flash through while the unlike is pending');

  h.calls[2].resolve();
  h.calls[1].resolve();
  await Promise.all([t2, t3]);
  assert.deepEqual([h.row('a').likedByMe, h.row('a').likeCount], [false, 10]);
  assert.deepEqual([h.row('b').likedByMe, h.row('b').likeCount], [true, 1]);
});

test('when the later of two taps fails, the row settles on what the server confirmed', async () => {
  const h = harness([post('a', false, 10)]);
  const t1 = h.tap('a'); // like
  const t2 = h.tap('a'); // unlike
  await h.settle();

  h.calls[0].resolve(); // like saved
  await t1;
  await h.settle();
  h.calls[1].reject(); // unlike lost
  await t2;

  assert.deepEqual(
    [h.row('a').likedByMe, h.row('a').likeCount],
    [true, 11],
    'not the pre-tap snapshot: the like really was saved',
  );
  assert.deepEqual(h.server.get('a'), { postId: 'a', likedByMe: true, likeCount: 11 });
});
