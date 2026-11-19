import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Post } from '../api/types.ts';
import { makeSeedPosts } from '../data/seed.ts';
import { formatPostTime, getPostItemType, samePostContent, samePostRow } from './rowModel.ts';

const posts = makeSeedPosts(12);
const textPost = posts.find((p) => !p.media)!;
const mediaPost = posts.find((p) => p.media)!;
const copy = (p: Post): Post => structuredClone(p);

test('seed data mixes text and photo posts', () => {
  const types = new Set(posts.map(getPostItemType));
  assert.deepEqual([...types].sort(), ['media', 'text']);
});

test('item type follows the media field', () => {
  assert.equal(getPostItemType(textPost), 'text');
  assert.equal(getPostItemType(mediaPost), 'media');
  assert.equal(getPostItemType({ ...mediaPost, media: undefined }), 'text');
});

test('a fresh copy with the same content counts as unchanged', () => {
  assert.ok(samePostRow(mediaPost, copy(mediaPost)), 'refresh copies must not re-render rows');
  assert.ok(samePostRow(textPost, copy(textPost)));
});

test('a like change re-renders the row but not its static content', () => {
  const liked = { ...textPost, likedByMe: !textPost.likedByMe, likeCount: textPost.likeCount + 1 };
  assert.equal(samePostRow(textPost, liked), false);
  assert.equal(samePostContent(textPost, liked), true);
});

test('any drawn field change is detected', () => {
  const changes: Partial<Post>[] = [
    { id: 'other' },
    { text: 'edited' },
    { createdAt: '2020-01-01T00:00:00.000Z' },
    { author: { ...textPost.author, name: 'Renamed' } },
    { media: { aspectRatio: 1, placeholderColor: '#000' } },
  ];
  for (const change of changes) {
    assert.equal(samePostContent(textPost, { ...textPost, ...change }), false, JSON.stringify(change));
  }
  assert.equal(samePostContent(mediaPost, { ...mediaPost, media: null }), false);
  assert.equal(
    samePostContent(mediaPost, { ...mediaPost, media: { ...mediaPost.media!, aspectRatio: 0.5 } }),
    false,
  );
});

test('null and missing media are treated the same', () => {
  assert.ok(samePostContent({ ...textPost, media: null }, { ...textPost, media: undefined }));
});

test('time is formatted with the shared formatter', () => {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  assert.equal(formatPostTime('2026-11-01T12:00:00.000Z', fmt), '1 Nov');
});
