# Devlog · 005


## Mon
- Set up Express + better-sqlite3, orders table, health and order endpoints, node:test suite.
- Learned: `node --test <dir>` is treated as a file in Node 22; pass a glob.
- 2026-11-09 (W3 Mon): Set up Express and sqlite project for idempotency outbox POC

## Tue
- Added idempotency_keys table and middleware that stores request hash + response and replays on retry; 422 on payload mismatch.
- Learned: canonicalising JSON (sorted keys) before hashing avoids false mismatches from key order.
- 2026-11-10 (W3 Tue): Add Idempotency-Key middleware storing request hash and response

## Wed
- Added outbox table and an order service that writes the order and its `order.created` event in one better-sqlite3 transaction; tests prove a failing outbox insert rolls back the order.
- Learned: a `BEFORE INSERT` trigger with `RAISE(ABORT)` is a neat way to simulate a failing write in tests.
- 2026-11-11 (W3 Wed): Write outbox event in the same transaction as order insert

## Thu
- Added the outbox relay worker: batched polling of due events, mark published only after publish resolves, capped exponential backoff with full jitter on failure, graceful stop. Wired it into the server with a console publisher.
- Learned: keep the `published_at` update outside the publish try/catch; otherwise a database error after a successful publish gets recorded as a publish failure.
- 2026-11-12 (W3 Thu): Add outbox relay worker with at-least-once delivery and backoff
