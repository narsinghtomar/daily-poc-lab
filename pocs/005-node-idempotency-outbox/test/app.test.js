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
