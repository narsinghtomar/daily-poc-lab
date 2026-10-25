'use strict';

/**
 * Token bucket rate limiter (in-memory).
 * - Each key gets `capacity` tokens.
 * - Tokens refill continuously at `refillPerSec`.
 * - Allows short bursts up to `capacity`, then a steady rate.
 *
 * `now` is injectable so the logic is deterministic in tests.
 */
class TokenBucketLimiter {
  constructor({ capacity, refillPerSec, now = () => Date.now() }) {
    if (capacity <= 0 || refillPerSec <= 0) {
      throw new Error('capacity and refillPerSec must be > 0');
    }
    this.capacity = capacity;
    this.refillPerMs = refillPerSec / 1000;
    this.now = now;
    this.buckets = new Map(); // key -> { tokens, last }
  }

  _refill(bucket, t) {
    const elapsed = t - bucket.last;
    if (elapsed > 0) {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
      bucket.last = t;
    }
  }

  /** Try to consume `cost` tokens. Returns { allowed, remaining, retryAfterMs }. */
  take(key, cost = 1) {
    const t = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, last: t };
      this.buckets.set(key, bucket);
    }
    this._refill(bucket, t);

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }
    const deficit = cost - bucket.tokens;
    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: Math.ceil(deficit / this.refillPerMs),
    };
  }
}

module.exports = { TokenBucketLimiter };
