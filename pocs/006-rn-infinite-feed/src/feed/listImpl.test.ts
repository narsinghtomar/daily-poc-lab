import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LIST_IMPL, FLAT_LIST_TUNING, resolveListImpl } from './listImpl.ts';

test('defaults to FlashList', () => {
  assert.equal(DEFAULT_LIST_IMPL, 'flash');
  assert.equal(resolveListImpl(undefined), 'flash');
  assert.equal(resolveListImpl(null), 'flash');
  assert.equal(resolveListImpl(''), 'flash');
});

test('accepts flat and flatlist in any case, with spaces', () => {
  assert.equal(resolveListImpl('flat'), 'flat');
  assert.equal(resolveListImpl(' FlatList '), 'flat');
  assert.equal(resolveListImpl('FLAT'), 'flat');
});

test('unknown values fall back to FlashList', () => {
  assert.equal(resolveListImpl('flash'), 'flash');
  assert.equal(resolveListImpl('flashlist'), 'flash');
  assert.equal(resolveListImpl('sectionlist'), 'flash');
});

test('FlatList tuning keeps fewer rows mounted than the defaults', () => {
  assert.ok(FLAT_LIST_TUNING.windowSize < 21);
  assert.ok(FLAT_LIST_TUNING.maxToRenderPerBatch <= 10);
});
