'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/db');
const { createOrderService, ORDER_CREATED } = require('../src/orders');

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

test('order insert writes one unpublished outbox event with the order payload', () => {
  const db = openDb(':memory:');
  try {
    const order = createOrderService(db).create({ amount_cents: 1250, currency: 'USD' });
    const event = db.prepare('SELECT * FROM outbox WHERE aggregate_id = ?').get(order.id);
    assert.strictEqual(event.aggregate_type, 'order');
    assert.strictEqual(event.event_type, ORDER_CREATED);
    assert.deepStrictEqual(JSON.parse(event.payload), order);
    assert.strictEqual(event.published_at, null);
    assert.strictEqual(event.attempts, 0);
  } finally { db.close(); }
});

test('failed outbox insert rolls back the order', () => {
  const db = openDb(':memory:');
  try {
    const orders = createOrderService(db);
    db.exec(`CREATE TRIGGER outbox_down BEFORE INSERT ON outbox
             BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END`);
    assert.throws(() => orders.create({ amount_cents: 500, currency: 'USD' }), /outbox unavailable/);
    assert.strictEqual(count(db, 'orders'), 0);
    assert.strictEqual(count(db, 'outbox'), 0);
  } finally { db.close(); }
});

test('failed order insert writes no outbox event', () => {
  const db = openDb(':memory:');
  try {
    // amount_cents CHECK constraint rejects the row inside the transaction
    assert.throws(() => createOrderService(db).create({ amount_cents: 0, currency: 'USD' }));
    assert.strictEqual(count(db, 'outbox'), 0);
  } finally { db.close(); }
});
