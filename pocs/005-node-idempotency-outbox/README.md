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
- Transactional outbox: `POST /orders` inserts the order and an `order.created` row in `outbox` inside one sqlite transaction, so the event exists if and only if the order does (`src/orders.js`)
- Unpublished events are indexed (`WHERE published_at IS NULL`) on `next_attempt_at` for the relay worker to poll
- Outbox relay worker (`src/relay.js`): polls due events in batches, calls `publish(event)`, and only then sets `published_at`, giving at-least-once delivery (a crash in between re-sends the same event id)
- Failed publishes bump `attempts`, record `last_error` and push `next_attempt_at` out with capped exponential backoff plus full jitter; one bad event does not block the rest of the batch
- `start()` / `stop()` with no overlapping passes; `stop()` waits for the in-flight pass so shutdown never closes the database mid-publish

## Usage
```bash
curl -X POST localhost:3000/orders -H 'content-type: application/json' \
  -H 'Idempotency-Key: 7c1f' -d '{"amount_cents":1250,"currency":"USD"}'
# repeat the exact call: same body and id, no second order
# the order and its order.created outbox event are committed together
# within ~1s the relay logs: published order.created <event id>
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
- Purge or archive published outbox rows so the table stays small
- Replace the console publisher with a real broker client and dedupe on event id in consumers
- Claim rows with a lease (`locked_until`) or `SELECT ... FOR UPDATE SKIP LOCKED` on Postgres so several relay instances can run
- Move events past a max attempt count to a dead-letter table and alert on it
- Publish per aggregate in order (stop that aggregate's events after a failure) if consumers need ordering
- Insert an in-progress marker so concurrent duplicates are handled (planned for Friday)

## Interview talking points
- Why hash the request: detects key reuse with a different payload
- Why replay errors too: a retry must see the same outcome as the original
- Why an outbox instead of publishing after commit: a crash between commit and publish loses the event; publishing before commit can announce an order that rolled back (dual-write problem)
- Why at-least-once and not exactly-once: publish and the `published_at` update cannot be atomic across broker and database, so duplicates are possible and consumers must be idempotent
- Why jitter on backoff: without it, many failed events retry in lockstep and hit a recovering broker at the same instant

## Daily plan
- [x] Mon: Express + sqlite (better-sqlite3) project setup
- [x] Tue: Idempotency-Key middleware storing request hash + response
- [x] Wed: Outbox table written in same transaction as order insert
- [x] Thu: Outbox relay worker with at-least-once delivery + backoff
- [ ] Fri: Concurrent duplicate requests return identical response
- [ ] Sat: README with sequence diagram and failure scenarios
- [ ] Sun: weekly review in DEVLOG.md
