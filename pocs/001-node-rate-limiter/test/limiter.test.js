'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TokenBucketLimiter } = require('../src/tokenBucket');
const { SlidingWindowLimiter } = require('../src/slidingWindow');

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('token bucket allows a burst up to capacity, then blocks', () => {
  const clock = fakeClock();
  const l = new TokenBucketLimiter({ capacity: 3, refillPerSec: 1, now: clock.now });
  assert.equal(l.take('a').allowed, true);
  assert.equal(l.take('a').allowed, true);
  assert.equal(l.take('a').allowed, true);
  const blocked = l.take('a');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 1000);
});

test('token bucket refills over time and never exceeds capacity', () => {
  const clock = fakeClock();
  const l = new TokenBucketLimiter({ capacity: 2, refillPerSec: 2, now: clock.now });
  l.take('a'); l.take('a');
  clock.advance(500); // +1 token
  assert.equal(l.take('a').allowed, true);
  assert.equal(l.take('a').allowed, false);
  clock.advance(60_000); // long idle
  l.take('a');
  assert.equal(l.buckets.get('a').tokens, 1); // capped at 2, minus 1
});

test('token bucket keys are isolated', () => {
  const clock = fakeClock();
  const l = new TokenBucketLimiter({ capacity: 1, refillPerSec: 1, now: clock.now });
  assert.equal(l.take('a').allowed, true);
  assert.equal(l.take('b').allowed, true);
  assert.equal(l.take('a').allowed, false);
});

test('sliding window enforces limit inside one window', () => {
  const clock = fakeClock(0);
  const l = new SlidingWindowLimiter({ limit: 3, windowMs: 1000, now: clock.now });
  assert.equal(l.take('a').allowed, true);
  assert.equal(l.take('a').allowed, true);
  assert.equal(l.take('a').allowed, true);
  assert.equal(l.take('a').allowed, false);
});

test('sliding window weights the previous window (no boundary burst)', () => {
  const clock = fakeClock(0);
  const l = new SlidingWindowLimiter({ limit: 4, windowMs: 1000, now: clock.now });
  clock.advance(900);
  for (let i = 0; i < 4; i++) l.take('a'); // 4 hits late in window 0
  clock.advance(200); // t=1100, 10% into window 1 -> prev weight 0.9 -> 3.6
  assert.equal(l.take('a').allowed, false); // a fixed window would have allowed this
  clock.advance(500); // t=1600 -> prev weight 0.4 -> 1.6
  assert.equal(l.take('a').allowed, true);
});

test('sliding window resets after skipping windows', () => {
  const clock = fakeClock(0);
  const l = new SlidingWindowLimiter({ limit: 1, windowMs: 1000, now: clock.now });
  l.take('a');
  clock.advance(5000);
  assert.equal(l.take('a').allowed, true);
});
