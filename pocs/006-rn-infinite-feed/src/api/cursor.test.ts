import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareFeedOrder, decodeCursor, encodeCursor } from './cursor.ts';

test('cursor round-trips and is url safe', () => {
  const key = { createdAt: '2026-11-01T12:00:00.000Z', id: 'p-0001' };
  const token = encodeCursor(key);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeCursor(token), key);
});

test('decodeCursor rejects garbage, wrong versions and bad fields', () => {
  const enc = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, '');
  for (const bad of [
    '',
    'not-base64!!',
    enc({ createdAt: '2026-11-01T12:00:00.000Z', id: 'p-1' }),
    enc(['v0', '2026-11-01T12:00:00.000Z', 'p-1']),
    enc(['v1', 'yesterday', 'p-1']),
    enc(['v1', '2026-11-01T12:00:00.000Z', '']),
    'a'.repeat(300),
  ]) {
    assert.equal(decodeCursor(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('feed order is newest first with id as tie-breaker', () => {
  const t = '2026-11-01T12:00:00.000Z';
  const older = '2026-11-01T11:00:00.000Z';
  assert.ok(compareFeedOrder({ createdAt: t, id: 'a' }, { createdAt: older, id: 'z' }) < 0);
  assert.ok(compareFeedOrder({ createdAt: t, id: 'b' }, { createdAt: t, id: 'a' }) < 0);
  assert.equal(compareFeedOrder({ createdAt: t, id: 'a' }, { createdAt: t, id: 'a' }), 0);
});
