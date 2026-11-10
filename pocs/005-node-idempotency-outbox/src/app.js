'use strict';
const crypto = require('node:crypto');
const express = require('express');
const { idempotency } = require('./idempotency');

function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use(idempotency(db));

  app.get('/health', (_req, res) => {
    const { ok } = db.prepare('SELECT 1 AS ok').get();
    res.json({ status: ok === 1 ? 'ok' : 'degraded' });
  });

  app.post('/orders', (req, res) => {
    const { amount_cents: amount, currency } = req.body || {};
    if (!Number.isInteger(amount) || amount <= 0 || typeof currency !== 'string') {
      return res.status(400).json({ error: 'amount_cents (positive integer) and currency are required' });
    }
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO orders (id, amount_cents, currency) VALUES (?, ?, ?)').run(id, amount, currency);
    res.status(201).json({ id, amount_cents: amount, currency });
  });

  app.get('/orders/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  return app;
}

module.exports = { createApp };
