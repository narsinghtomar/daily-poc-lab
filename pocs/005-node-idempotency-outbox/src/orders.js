'use strict';
const crypto = require('node:crypto');

const ORDER_CREATED = 'order.created';

// Writes the order and its outbox event atomically: either both rows commit
// or neither does, so an event is never lost and never published for an
// order that does not exist.
function createOrderService(db) {
  const insertOrder = db.prepare('INSERT INTO orders (id, amount_cents, currency) VALUES (?, ?, ?)');
  const insertEvent = db.prepare(
    'INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload) VALUES (?, ?, ?, ?, ?)',
  );

  const create = db.transaction(({ amount_cents: amount, currency }) => {
    const order = { id: crypto.randomUUID(), amount_cents: amount, currency };
    insertOrder.run(order.id, amount, currency);
    insertEvent.run(crypto.randomUUID(), 'order', order.id, ORDER_CREATED, JSON.stringify(order));
    return order;
  });

  return { create };
}

module.exports = { createOrderService, ORDER_CREATED };
