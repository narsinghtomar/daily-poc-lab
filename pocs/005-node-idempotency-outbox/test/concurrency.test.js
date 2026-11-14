'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const express = require('express');
const { setTimeout: sleep } = require('node:timers/promises');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const { idempotency, hashRequest } = require('../src/idempotency');

// A slow async handler widens the race window so duplicates truly overlap.
function slowApp(db, { delayMs = 50, status = 201, options } = {}) {
  const calls = { n: 0 };
  const app = express();
  app.use(express.json());
  app.use(idempotency(db, options));
  app.post('/charges', async (req, res) => {
    calls.n += 1;
    await sleep(delayMs);
    if (typeof status === 'function') return status(req, res, calls.n);
    res.status(status).json({ id: crypto.randomUUID(), amount_cents: req.body.amount_cents });
  });
  return { app, calls };
}

async function listen(app, fn) {
  const server = app.listen(0);
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

const post = (base, path, body, key) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
  body: JSON.stringify(body),
});

const snapshot = async (res) => ({ status: res.status, body: await res.text() });

test('concurrent duplicates run the handler once and all get the identical response', async () => {
  const db = openDb(':memory:');
  const { app, calls } = slowApp(db);
  try {
    await listen(app, async (base) => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => post(base, '/charges', { amount_cents: 500 }, 'c1')),
      );
      const bodies = await Promise.all(responses.map(snapshot));
      assert.strictEqual(calls.n, 1);
      assert.strictEqual(new Set(bodies.map((b) => JSON.stringify(b))).size, 1);
      assert.strictEqual(bodies[0].status, 201);
      const replayed = responses.filter((r) => r.headers.get('idempotent-replayed') === 'true');
      assert.strictEqual(replayed.length, 9);
    });
  } finally { db.close(); }
});

test('a concurrent duplicate with a different payload is rejected with 422', async () => {
  const db = openDb(':memory:');
  const { app, calls } = slowApp(db);
  try {
    await listen(app, async (base) => {
      const [a, b] = await Promise.all([
        post(base, '/charges', { amount_cents: 500 }, 'c2'),
        sleep(5).then(() => post(base, '/charges', { amount_cents: 999 }, 'c2')),
      ]);
      assert.strictEqual(a.status, 201);
      assert.strictEqual(b.status, 422);
      assert.strictEqual(calls.n, 1);
    });
  } finally { db.close(); }
});

test('a duplicate that outwaits the in-flight request gets 409 with Retry-After', async () => {
  const db = openDb(':memory:');
  const { app } = slowApp(db, { delayMs: 150, options: { waitMs: 30 } });
  try {
    await listen(app, async (base) => {
      const [a, b] = await Promise.all([
        post(base, '/charges', { amount_cents: 500 }, 'c3'),
        sleep(5).then(() => post(base, '/charges', { amount_cents: 500 }, 'c3')),
      ]);
      assert.strictEqual(a.status, 201);
      assert.strictEqual(b.status, 409);
      assert.strictEqual(b.headers.get('retry-after'), '1');
    });
  } finally { db.close(); }
});

test('when the in-flight request fails with 5xx a waiting duplicate takes over', async () => {
  const db = openDb(':memory:');
  const { app, calls } = slowApp(db, {
    status: (req, res, n) => (n === 1
      ? res.status(503).json({ error: 'upstream unavailable' })
      : res.status(201).json({ attempt: n })),
  });
  try {
    await listen(app, async (base) => {
      const [a, b] = await Promise.all([
        post(base, '/charges', { amount_cents: 500 }, 'c4'),
        sleep(5).then(() => post(base, '/charges', { amount_cents: 500 }, 'c4')),
      ]);
      assert.strictEqual(a.status, 503);
      assert.strictEqual(b.status, 201);
      assert.deepStrictEqual(await b.json(), { attempt: 2 });
      assert.strictEqual(calls.n, 2);
    });
  } finally { db.close(); }
});

test('a thrown handler error releases the key so a retry can run', async () => {
  const db = openDb(':memory:');
  let fail = true;
  const app = express();
  app.use(express.json());
  app.use(idempotency(db));
  app.post('/charges', async (_req, res) => {
    if (fail) { fail = false; throw new Error('boom'); }
    res.status(201).json({ ok: true });
  });
  // Silence Express's default error logging for the deliberate failure.
  app.use((_err, _req, res, _next) => res.status(500).end());
  try {
    await listen(app, async (base) => {
      assert.strictEqual((await post(base, '/charges', { amount_cents: 1 }, 'c5')).status, 500);
      assert.strictEqual((await post(base, '/charges', { amount_cents: 1 }, 'c5')).status, 201);
    });
  } finally { db.close(); }
});

test('an abandoned in-progress marker is taken over after the lock TTL', async () => {
  const db = openDb(':memory:');
  const { app, calls } = slowApp(db, { delayMs: 0, options: { lockTtlMs: 1_000 } });
  // Simulate a process that crashed after claiming the key.
  const hash = hashRequest({ method: 'POST', path: '/charges', body: { amount_cents: 500 } });
  db.prepare('INSERT INTO idempotency_keys (key, request_hash, lock_token, locked_at) VALUES (?, ?, ?, ?)')
    .run('c6', hash, 'dead-owner', Date.now() - 5_000);
  try {
    await listen(app, async (base) => {
      const res = await post(base, '/charges', { amount_cents: 500 }, 'c6');
      assert.strictEqual(res.status, 201);
      assert.strictEqual(calls.n, 1);
    });
  } finally { db.close(); }
});

test('a slow owner whose lock was taken over cannot overwrite the new owner\'s response', async () => {
  const db = openDb(':memory:');
  // The handler outlives the lock TTL, so a duplicate takes the key over mid-flight.
  const calls = { n: 0 };
  const app = express();
  app.use(express.json());
  app.use(idempotency(db, { lockTtlMs: 50, waitMs: 2_000 }));
  app.post('/charges', async (_req, res) => {
    const owner = ++calls.n;
    await sleep(300);
    res.status(201).json({ owner });
  });
  try {
    await listen(app, async (base) => {
      const original = post(base, '/charges', { amount_cents: 700 }, 'c7');
      await sleep(100);
      const takeover = post(base, '/charges', { amount_cents: 700 }, 'c7');
      const [first, second] = await Promise.all([original, takeover]);
      assert.deepStrictEqual(await first.json(), { owner: 1 });
      assert.deepStrictEqual(await second.json(), { owner: 2 });
      assert.strictEqual(calls.n, 2);
      // The stored result belongs to the owner holding the current lock token.
      const retry = await post(base, '/charges', { amount_cents: 700 }, 'c7');
      assert.strictEqual(retry.headers.get('idempotent-replayed'), 'true');
      assert.deepStrictEqual(await retry.json(), { owner: 2 });
    });
  } finally { db.close(); }
});

test('concurrent duplicate POST /orders create one order and one outbox event', async () => {
  const db = openDb(':memory:');
  try {
    await listen(createApp(db), async (base) => {
      const responses = await Promise.all(
        Array.from({ length: 20 }, () => post(base, '/orders', { amount_cents: 1250, currency: 'USD' }, 'o1')),
      );
      const bodies = await Promise.all(responses.map(snapshot));
      assert.strictEqual(new Set(bodies.map((b) => JSON.stringify(b))).size, 1);
      assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
      assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n, 1);
    });
  } finally { db.close(); }
});
