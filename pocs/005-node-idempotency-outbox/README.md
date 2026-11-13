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
- Concurrent duplicates (`src/idempotency.js`): the first request claims the key by inserting an in-progress marker (`status_code IS NULL`, plus a random `lock_token`) in one atomic upsert; duplicates arriving while it runs poll until the response is recorded and replay it byte for byte, so the handler runs once and every caller gets the identical response
- A duplicate still waiting after `waitMs` (default 5s) gets `409` with `Retry-After: 1`; if the in-flight request fails with 5xx or throws, the marker is released and a waiting duplicate takes over
- A marker left by a crashed process is taken over once older than `lockTtlMs` (default 30s); completion and release are fenced on `lock_token`, so a slow original cannot overwrite the new owner's result
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
# fire the same call 10 times in parallel: one order, ten identical responses
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
- Wake waiting duplicates with a notification (Postgres `LISTEN/NOTIFY`, Redis pub/sub) instead of polling
- Tune `waitMs` below the client and load balancer timeouts so duplicates get a clear 409 rather than a gateway timeout

## Interview talking points
- Why hash the request: detects key reuse with a different payload
- Why replay errors too: a retry must see the same outcome as the original
- Why an outbox instead of publishing after commit: a crash between commit and publish loses the event; publishing before commit can announce an order that rolled back (dual-write problem)
- Why at-least-once and not exactly-once: publish and the `published_at` update cannot be atomic across broker and database, so duplicates are possible and consumers must be idempotent
- Why an in-progress marker: check-then-insert has a race where two duplicates both miss the lookup and both charge; a single atomic insert lets exactly one win
- Why wait instead of returning 409 straight away: the client wanted the result, and replaying it is the same answer the original caller saw
- Why a lock token: after a stale takeover the original owner may still finish, and fencing its writes on the token stops it clobbering the new owner
- Why jitter on backoff: without it, many failed events retry in lockstep and hit a recovering broker at the same instant

## Daily plan
- [x] Mon: Express + sqlite (better-sqlite3) project setup
- [x] Tue: Idempotency-Key middleware storing request hash + response
- [x] Wed: Outbox table written in same transaction as order insert
- [x] Thu: Outbox relay worker with at-least-once delivery + backoff
- [x] Fri: Concurrent duplicate requests return identical response
- [ ] Sat: README with sequence diagram and failure scenarios
- [ ] Sun: weekly review in DEVLOG.md
