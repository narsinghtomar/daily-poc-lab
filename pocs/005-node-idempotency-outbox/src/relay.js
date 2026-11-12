'use strict';

// Outbox relay: polls unpublished events and hands them to `publish`.
//
// Delivery is at-least-once. An event is marked published only after
// `publish` resolves, so a crash between the two re-sends it on the next
// poll; consumers must dedupe on event id. A failed publish bumps
// `attempts` and schedules the next try with capped exponential backoff
// plus full jitter, so a broken broker is not hammered in lockstep.

function backoffDelay(attempt, { baseDelayMs, maxDelayMs, random = Math.random }) {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(random() * ceiling);
}

function createRelay(db, {
  publish,
  batchSize = 50,
  pollIntervalMs = 1000,
  baseDelayMs = 500,
  maxDelayMs = 60_000,
  now = Date.now,
  random = Math.random,
  logger = console,
} = {}) {
  if (typeof publish !== 'function') throw new TypeError('publish(event) is required');

  const due = db.prepare(`
    SELECT id, aggregate_type, aggregate_id, event_type, payload, attempts
      FROM outbox
     WHERE published_at IS NULL AND next_attempt_at <= ?
     ORDER BY next_attempt_at, created_at
     LIMIT ?`);
  const markPublished = db.prepare(`
    UPDATE outbox
       SET published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), attempts = attempts + 1, last_error = NULL
     WHERE id = ? AND published_at IS NULL`);
  const markFailed = db.prepare(`
    UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?`);

  // One pass over due events. Returns counts so callers and tests can observe progress.
  async function runOnce() {
    const result = { published: 0, failed: 0 };
    for (const row of due.all(now(), batchSize)) {
      const event = {
        id: row.id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        type: row.event_type,
        payload: JSON.parse(row.payload),
      };
      try {
        await publish(event);
      } catch (err) {
        const attempts = row.attempts + 1;
        const delay = backoffDelay(attempts, { baseDelayMs, maxDelayMs, random });
        markFailed.run(attempts, now() + delay, String(err?.message ?? err).slice(0, 500), row.id);
        result.failed += 1;
        continue;
      }
      // A database error here aborts the pass; the event stays unpublished
      // and is sent again later, which at-least-once delivery allows.
      markPublished.run(row.id);
      result.published += 1;
    }
    return result;
  }

  let timer = null;
  let inFlight = null;
  let running = false;

  function schedule() {
    timer = setTimeout(tick, pollIntervalMs);
    timer.unref?.();
  }

  async function tick() {
    timer = null;
    inFlight = runOnce().catch((err) => logger.error('outbox relay pass failed', err));
    await inFlight;
    inFlight = null;
    if (running) schedule();
  }

  return {
    runOnce,
    start() {
      if (running) return;
      running = true;
      schedule();
    },
    // Stops polling and waits for an in-progress pass, so shutdown never
    // closes the database under a running publish.
    async stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
      if (inFlight) await inFlight;
    },
  };
}

module.exports = { createRelay, backoffDelay };
