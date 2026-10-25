'use strict';

/**
 * Sliding window counter rate limiter (in-memory).
 * Approximates a true sliding log with O(1) memory per key by weighting
 * the previous fixed window's count by how much of it still overlaps.
 *
 *   estimated = prevCount * (1 - elapsedInCurrent / windowMs) + currCount
 */
class SlidingWindowLimiter {
  constructor({ limit, windowMs, now = () => Date.now() }) {
    if (limit <= 0 || windowMs <= 0) throw new Error('limit and windowMs must be > 0');
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.state = new Map(); // key -> { windowStart, curr, prev }
  }

  take(key) {
    const t = this.now();
    const windowStart = Math.floor(t / this.windowMs) * this.windowMs;
    let s = this.state.get(key);

    if (!s) {
      s = { windowStart, curr: 0, prev: 0 };
      this.state.set(key, s);
    } else if (windowStart !== s.windowStart) {
      // Moved to a new window. If we skipped more than one, prev is 0.
      s.prev = windowStart - s.windowStart === this.windowMs ? s.curr : 0;
      s.curr = 0;
      s.windowStart = windowStart;
    }

    const overlap = 1 - (t - windowStart) / this.windowMs;
    const estimated = s.prev * overlap + s.curr;

    if (estimated + 1 > this.limit) {
      return { allowed: false, remaining: 0, estimated };
    }
    s.curr += 1;
    return { allowed: true, remaining: Math.max(0, Math.floor(this.limit - estimated - 1)), estimated: estimated + 1 };
  }
}

module.exports = { SlidingWindowLimiter };
