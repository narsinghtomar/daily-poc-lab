'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

async function withServer(fn) {
  const db = openDb(':memory:');
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); db.close(); }
}

test('health responds ok', () => withServer(async (base) => {
  const res = await fetch(`${base}/health`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { status: 'ok' });
}));

test('creates and fetches an order', () => withServer(async (base) => {
  const res = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount_cents: 1250, currency: 'USD' }),
  });
  assert.strictEqual(res.status, 201);
  const { id } = await res.json();
  const got = await (await fetch(`${base}/orders/${id}`)).json();
  assert.strictEqual(got.amount_cents, 1250);
}));

test('rejects invalid order', () => withServer(async (base) => {
  const res = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount_cents: -5, currency: 'USD' }),
  });
  assert.strictEqual(res.status, 400);
}));

const post = (base, body, key) => fetch(`${base}/orders`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
  body: JSON.stringify(body),
});

test('same key and payload replays the stored response without a second insert', async () => {
  const db = openDb(':memory:');
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const first = await post(base, { amount_cents: 500, currency: 'USD' }, 'k1');
    const second = await post(base, { currency: 'USD', amount_cents: 500 }, 'k1');
    assert.strictEqual(first.status, 201);
    assert.strictEqual(second.status, 201);
    assert.strictEqual(second.headers.get('idempotent-replayed'), 'true');
    assert.deepStrictEqual(await second.json(), await first.json());
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
  } finally { server.close(); db.close(); }
});

test('same key with a different payload is rejected with 422', () => withServer(async (base) => {
  await post(base, { amount_cents: 500, currency: 'USD' }, 'k2');
  const res = await post(base, { amount_cents: 900, currency: 'USD' }, 'k2');
  assert.strictEqual(res.status, 422);
}));

test('validation errors are stored and replayed too', () => withServer(async (base) => {
  const a = await post(base, { amount_cents: -1, currency: 'USD' }, 'k3');
  const b = await post(base, { amount_cents: -1, currency: 'USD' }, 'k3');
  assert.strictEqual(a.status, 400);
  assert.strictEqual(b.status, 400);
  assert.strictEqual(b.headers.get('idempotent-replayed'), 'true');
}));

test('requests without a key are not deduplicated', async () => {
  const db = openDb(':memory:');
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await post(base, { amount_cents: 500, currency: 'USD' });
    await post(base, { amount_cents: 500, currency: 'USD' });
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 2);
  } finally { server.close(); db.close(); }
});
