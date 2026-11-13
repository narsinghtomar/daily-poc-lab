'use strict';
const Database = require('better-sqlite3');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency     TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A row with status_code NULL is an in-progress marker: the request that
-- inserted it (identified by lock_token) is still running. Duplicates wait for
-- the response to be recorded; a marker older than the lock TTL is taken over.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key           TEXT PRIMARY KEY,
  request_hash  TEXT NOT NULL,
  lock_token    TEXT,
  locked_at     INTEGER,
  status_code   INTEGER,
  response_body TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((status_code IS NULL) = (response_body IS NULL))
);

-- Transactional outbox: events are written in the same transaction as the
-- state change, then delivered later by a relay. published_at stays NULL
-- until delivery succeeds; failed attempts push next_attempt_at forward.
CREATE TABLE IF NOT EXISTS outbox (
  id             TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  payload        TEXT NOT NULL,
  attempts       INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  last_error     TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at   TEXT
);

CREATE INDEX IF NOT EXISTS outbox_unpublished
  ON outbox (next_attempt_at, created_at) WHERE published_at IS NULL;
`;

function openDb(file = process.env.DB_FILE || ':memory:') {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
