'use strict';
const Database = require('better-sqlite3');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency     TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`;

function openDb(file = process.env.DB_FILE || ':memory:') {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
