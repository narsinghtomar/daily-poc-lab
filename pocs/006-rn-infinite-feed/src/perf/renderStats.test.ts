import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary, RenderStats } from './renderStats.ts';

test('empty stats summarise to zeros', () => {
  const s = new RenderStats().summary();
  assert.equal(s.commits, 0);
  assert.equal(s.avgMs, 0);
});

test('summary reports average, p95, max and commits over the frame budget', () => {
  const stats = new RenderStats();
  stats.record({ phase: 'mount', actualDuration: 30 });
  for (let i = 1; i <= 19; i++) stats.record({ phase: 'update', actualDuration: i % 2 ? 2 : 4 });
  const s = stats.summary();
  assert.equal(s.commits, 20);
  assert.equal(s.mounts, 1);
  assert.equal(s.maxMs, 30);
  assert.equal(s.p95Ms, 4, '19th of 20 sorted samples');
  assert.equal(s.slowCommits, 1);
  assert.equal(s.totalMs, 30 + 10 * 2 + 9 * 4);
  assert.equal(s.avgMs, 4.3);
});

test('only the most recent samples are kept', () => {
  const stats = new RenderStats(3);
  for (const ms of [100, 1, 2, 3]) stats.record({ phase: 'update', actualDuration: ms });
  assert.equal(stats.size, 3);
  assert.equal(stats.summary().maxMs, 3);
});

test('reset clears everything', () => {
  const stats = new RenderStats();
  stats.record({ phase: 'mount', actualDuration: 5 });
  stats.reset();
  assert.equal(stats.summary().commits, 0);
  assert.equal(stats.summary().mounts, 0);
});

test('summary line is readable in the Metro log', () => {
  const stats = new RenderStats();
  stats.record({ phase: 'mount', actualDuration: 20 });
  assert.match(formatSummary('feed', stats.summary()), /^\[perf\] feed: 1 commits \(1 mounts\), avg 20 ms.*1 over 16.7 ms$/);
});
