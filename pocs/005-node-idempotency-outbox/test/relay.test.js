'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/db');
const { createOrderService, ORDER_CREATED } = require('../src/orders');
const { createRelay, backoffDelay } = require('../src/relay');

const silent = { error() {} };

function setup(opts = {}) {
  const db = openDb(':memory:');
  let clock = Date.now() + 1;
  const sent = [];
  const relay = createRelay(db, {
    publish: async (event) => { sent.push(event); },
    now: () => clock,
    random: () => 1, // deterministic: use the full backoff ceiling
    baseDelayMs: 100,
    maxDelayMs: 1000,
    logger: silent,
    ...opts,
  });
  return {
    db, relay, sent,
    orders: createOrderService(db),
    advance: (ms) => { clock += ms; },
    row: (id) => db.prepare('SELECT * FROM outbox WHERE aggregate_id = ?').get(id),
  };
}

test('backoff grows exponentially and is capped', () => {
  const opts = { baseDelayMs: 100, maxDelayMs: 1000, random: () => 1 };
  assert.deepStrictEqual([1, 2, 3, 4, 5, 10].map((a) => backoffDelay(a, opts)), [100, 200, 400, 800, 1000, 1000]);
  assert.strictEqual(backoffDelay(3, { ...opts, random: () => 0.5 }), 200);
});

test('publishes due events and marks them published', async () => {
  const t = setup();
  try {
    const order = t.orders.create({ amount_cents: 1250, currency: 'USD' });
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 1, failed: 0 });
    assert.strictEqual(t.sent.length, 1);
    assert.strictEqual(t.sent[0].type, ORDER_CREATED);
    assert.deepStrictEqual(t.sent[0].payload, order);
    const row = t.row(order.id);
    assert.ok(row.published_at);
    assert.strictEqual(row.attempts, 1);
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 0, failed: 0 });
  } finally { t.db.close(); }
});

test('failed publish is retried after backoff, then delivered', async () => {
  let failures = 2;
  const delivered = [];
  const t = setup({
    publish: async (event) => {
      if (failures-- > 0) throw new Error('broker unavailable');
      delivered.push(event.id);
    },
  });
  try {
    const order = t.orders.create({ amount_cents: 500, currency: 'EUR' });

    assert.deepStrictEqual(await t.relay.runOnce(), { published: 0, failed: 1 });
    let row = t.row(order.id);
    assert.strictEqual(row.attempts, 1);
    assert.strictEqual(row.last_error, 'broker unavailable');
    assert.strictEqual(row.published_at, null);

    // not due yet: backoff holds it back
    t.advance(99);
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 0, failed: 0 });

    t.advance(1);
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 0, failed: 1 });
    assert.strictEqual(t.row(order.id).attempts, 2);

    t.advance(199);
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 0, failed: 0 });
    t.advance(1);
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 1, failed: 0 });

    row = t.row(order.id);
    assert.ok(row.published_at);
    assert.strictEqual(row.attempts, 3);
    assert.strictEqual(row.last_error, null);
    assert.strictEqual(delivered.length, 1);
  } finally { t.db.close(); }
});

test('one failing event does not block others in the batch', async () => {
  const t = setup({
    publish: async (event) => {
      if (event.payload.currency === 'BAD') throw new Error('rejected');
      t.sent.push(event);
    },
  });
  try {
    t.orders.create({ amount_cents: 1, currency: 'BAD' });
    t.orders.create({ amount_cents: 2, currency: 'USD' });
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 1, failed: 1 });
  } finally { t.db.close(); }
});

test('crash after publish but before marking re-delivers (at-least-once)', async () => {
  const t = setup();
  try {
    const order = t.orders.create({ amount_cents: 700, currency: 'USD' });
    // Simulate the process dying between publish and the published_at update.
    t.db.exec(`CREATE TRIGGER crash BEFORE UPDATE OF published_at ON outbox
               BEGIN SELECT RAISE(ABORT, 'process killed'); END`);
    await assert.rejects(t.relay.runOnce(), /process killed/);
    assert.strictEqual(t.row(order.id).published_at, null);

    t.db.exec('DROP TRIGGER crash');
    await t.relay.runOnce();
    assert.strictEqual(t.sent.length, 2);
    assert.strictEqual(t.sent[0].id, t.sent[1].id, 'same event id lets consumers dedupe');
  } finally { t.db.close(); }
});

test('respects batch size', async () => {
  const t = setup({ batchSize: 2 });
  try {
    for (let i = 1; i <= 3; i++) t.orders.create({ amount_cents: i, currency: 'USD' });
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 2, failed: 0 });
    assert.deepStrictEqual(await t.relay.runOnce(), { published: 1, failed: 0 });
  } finally { t.db.close(); }
});

test('start polls in the background and stop waits for the pass', async () => {
  const db = openDb(':memory:');
  const sent = [];
  const relay = createRelay(db, {
    publish: async (e) => { sent.push(e.id); },
    pollIntervalMs: 5,
    logger: silent,
  });
  try {
    createOrderService(db).create({ amount_cents: 10, currency: 'USD' });
    relay.start();
    for (let i = 0; i < 50 && sent.length === 0; i++) await new Promise((r) => setTimeout(r, 5));
    await relay.stop();
    assert.strictEqual(sent.length, 1);
  } finally { db.close(); }
});

test('requires a publish function', () => {
  const db = openDb(':memory:');
  try {
    assert.throws(() => createRelay(db, {}), /publish/);
  } finally { db.close(); }
});
