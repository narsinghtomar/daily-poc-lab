# Devlog · 005


## Mon
- Set up Express + better-sqlite3, orders table, health and order endpoints, node:test suite.
- Learned: `node --test <dir>` is treated as a file in Node 22; pass a glob.
- 2026-11-09 (W3 Mon): Set up Express and sqlite project for idempotency outbox POC

## Tue
- Added idempotency_keys table and middleware that stores request hash + response and replays on retry; 422 on payload mismatch.
- Learned: canonicalising JSON (sorted keys) before hashing avoids false mismatches from key order.
- 2026-11-10 (W3 Tue): Add Idempotency-Key middleware storing request hash and response
