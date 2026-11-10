# 005 · Idempotency keys + transactional outbox for payments-style APIs

**Stack:** Node.js · **Week:** 3 · **Status:** in progress

## Problem
Clients retry payment requests after timeouts, and services must not double-charge or lose events. This POC builds idempotency keys plus a transactional outbox so retries are safe and events are published at-least-once.

## What this POC shows
- Express API backed by a synchronous sqlite database (better-sqlite3, WAL mode)
- Orders schema with constraints enforced at the database level
- App factory pattern so tests run against an in-memory database
- `Idempotency-Key` middleware on POST requests: the first response (status + body) is stored with a SHA-256 of method, path and canonical body; a retry with the same key replays it (`Idempotent-Replayed: true`), and reusing a key with a different payload returns 422
- 5xx responses are not stored, so transient failures stay retryable

## Usage
```bash
curl -X POST localhost:3000/orders -H 'content-type: application/json' \
  -H 'Idempotency-Key: 7c1f' -d '{"amount_cents":1250,"currency":"USD"}'
# repeat the exact call: same body and id, no second order
```

## Run
```bash
yarn install
yarn test
yarn start   # http://localhost:3000, set PORT / DB_FILE to override
```

## What I'd do in production
- Expire keys after a TTL (e.g. 24h) with a cleanup job
- Scope keys per client/account so tenants cannot collide
- Insert an in-progress marker so concurrent duplicates are handled (planned for Friday)

## Interview talking points
- Why hash the request: detects key reuse with a different payload
- Why replay errors too: a retry must see the same outcome as the original

## Daily plan
- [x] Mon: Express + sqlite (better-sqlite3) project setup
- [x] Tue: Idempotency-Key middleware storing request hash + response
- [ ] Wed: Outbox table written in same transaction as order insert
- [ ] Thu: Outbox relay worker with at-least-once delivery + backoff
- [ ] Fri: Concurrent duplicate requests return identical response
- [ ] Sat: README with sequence diagram and failure scenarios
- [ ] Sun: weekly review in DEVLOG.md
