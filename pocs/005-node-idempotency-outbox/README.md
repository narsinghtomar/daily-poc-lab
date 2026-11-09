# 005 · Idempotency keys + transactional outbox for payments-style APIs

**Stack:** Node.js · **Week:** 3 · **Status:** in progress

## Problem
Clients retry payment requests after timeouts, and services must not double-charge or lose events. This POC builds idempotency keys plus a transactional outbox so retries are safe and events are published at-least-once.

## What this POC shows
- Express API backed by a synchronous sqlite database (better-sqlite3, WAL mode)
- Orders schema with constraints enforced at the database level
- App factory pattern so tests run against an in-memory database

## Run
```bash
yarn install
yarn test
yarn start   # http://localhost:3000, set PORT / DB_FILE to override
```

## What I'd do in production
-

## Interview talking points
-

## Daily plan
- [x] Mon: Express + sqlite (better-sqlite3) project setup
- [ ] Tue: Idempotency-Key middleware storing request hash + response
- [ ] Wed: Outbox table written in same transaction as order insert
- [ ] Thu: Outbox relay worker with at-least-once delivery + backoff
- [ ] Fri: Concurrent duplicate requests return identical response
- [ ] Sat: README with sequence diagram and failure scenarios
- [ ] Sun: weekly review in DEVLOG.md
