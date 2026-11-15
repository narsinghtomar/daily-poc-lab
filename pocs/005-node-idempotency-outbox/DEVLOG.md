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

## Fri
- Made the Idempotency-Key middleware safe under concurrency: atomic claim with an in-progress marker, duplicates wait and replay the identical response, 409 + Retry-After on timeout, release on 5xx/throw, stale-lock takeover fenced by a lock token. Tests fire parallel duplicates against a slow handler and against `POST /orders`.
- Learned: releasing the key when the client disconnects looks tidy but is wrong; the handler may still be running, and a retry would execute it twice. Only the TTL should reclaim it.
- Schema note: `idempotency_keys.status_code` / `response_body` are now nullable, so an existing `DB_FILE` from earlier in the week must be recreated.
- 2026-11-13 (W3 Fri): Return identical responses to concurrent duplicate requests

## Sat
- Added a Mermaid sequence diagram (claim, concurrent duplicate, replay, relay) and a failure-scenario table mapping each case to its outcome and the test that covers it.
- Added a test for the one scenario without coverage: a handler that outlives the lock TTL. The duplicate takes over, and the slow owner's completion is fenced on `lock_token`, so later retries replay the new owner's response.
- Learned: writing the failure table showed which claims had no tests behind them. A shared counter read after an `await` also gave wrong owner ids; capture per-request state before suspending.
- 2026-11-14 (W3 Sat): Document request flow and failure scenarios with a sequence diagram

## Sun
- Reran the suite (27 passing), wrote the weekly review below and marked the POC done.

## Weekly review

### What worked
- The app factory with an injected database meant every test ran against a fresh in-memory sqlite, so concurrency and crash cases stayed fast and isolated.
- better-sqlite3 being synchronous made the order + outbox transaction trivially atomic: no awaits inside the transaction, nothing to interleave.
- Building the plain idempotency middleware on Tuesday and hardening it for concurrency on Friday kept each step small; the Friday change was mostly a new claim step in front of the existing replay path.
- Injecting `publish`, the clock and the backoff jitter made the relay tests deterministic, including retry timing and the crash-between-publish-and-mark case.
- Writing the failure-scenario table on Saturday exposed the one untested claim (handler outliving the lock TTL), which then got a test.

### What I would change
- Duplicates poll sqlite while they wait. On Postgres I would use `LISTEN/NOTIFY` (or Redis pub/sub) so waiters wake on completion instead of every `pollMs`.
- The relay assumes a single instance. For several workers, claim rows with a lease (`locked_until`) or `FOR UPDATE SKIP LOCKED`.
- No dead-letter handling: an event that never publishes retries forever with capped backoff. Add a max attempt count, a dead-letter table and an alert.
- Keys are global and never expire. Scope them per client and add a TTL cleanup job; purge published outbox rows the same way.
- The Friday schema change made `status_code` nullable without a migration, so an old `DB_FILE` had to be recreated. Even in a POC, a tiny versioned migration step would have been cheaper.
- The publisher is a console stub; wiring a real broker (and a consumer that dedupes on event id) would prove the end-to-end at-least-once story.

### Interview talking points
- Idempotency key flow: atomic claim with an in-progress marker, run once, store status + body, replay byte for byte; 422 when the same key arrives with a different payload hash.
- Why replay 4xx but not 5xx: a retry must see the original outcome, but transient server failures should stay retryable.
- Lock TTL plus fencing token: the TTL guesses the owner is dead, the token makes a wrong guess harmless to stored state.
- Dual-write problem and the transactional outbox: the event is committed with the order, and a relay publishes it afterwards.
- At-least-once, not exactly-once: publish and `published_at` cannot be atomic across broker and database, so consumers dedupe on event id.
- Capped exponential backoff with full jitter keeps retries from stampeding a recovering broker; one failing event never blocks the batch.
- 2026-11-15 (W3 Sun): Add weekly review for idempotency outbox POC
