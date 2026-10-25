# POC Lab

Small, focused proofs of concept across the stacks I lead: **Node.js, React / Next.js, React Native, Flutter and AI/LLM integration**.

Each POC answers one engineering question, is time-boxed to a week, and ships in daily milestones. Every POC README covers the problem, what it shows, how to run it, what I'd change for production, and the trade-offs.

## POCs

<!-- POC_INDEX_START -->
| # | POC | Stack | Status |
|---|---|---|---|
| 001 | [Node.js rate limiter](pocs/001-node-rate-limiter) | Node.js | Done |
| 002 | [AI diff reviewer](pocs/002-ai-diff-reviewer) | Node.js + AI | Done |
| 003 | Offline-first task app (Riverpod + Hive) | Flutter | Planned (week 1) |
| 004 | Listings page with App Router, ISR and Server Actions | React / Next.js | Planned (week 2) |
| 005 | Idempotency keys + transactional outbox for payments-style APIs | Node.js | Planned (week 3) |
| 006 | Infinite feed with FlashList, pagination and optimistic likes | React Native | Planned (week 4) |
| 007 | RAG over markdown docs with citations | AI / LLM | Planned (week 5) |
| 008 | BLoC auth flow with token refresh interceptor (Dio) | Flutter | Planned (week 6) |
| 009 | Background jobs with BullMQ: retries, DLQ, rate limit | Node.js | Planned (week 7) |
| 010 | 100k-row table: virtualization + Web Worker CSV parsing | React / Next.js | Planned (week 8) |
| 011 | Offline mutation queue with NetInfo + MMKV | React Native | Planned (week 9) |
| 012 | Tool-calling agent over a small REST API | AI / LLM | Planned (week 10) |
| 013 | CustomPainter charts with animations + golden tests | Flutter | Planned (week 11) |
| 014 | Realtime notifications with Server-Sent Events | Node.js + Next.js | Planned (week 12) |
<!-- POC_INDEX_END -->

## Featured

- **[001 · Rate limiter](pocs/001-node-rate-limiter):** token bucket vs sliding window, deterministic tests with an injectable clock, `429` + `Retry-After` demo server.
- **[002 · AI diff reviewer](pocs/002-ai-diff-reviewer):** LLM review of `git diff` with validated JSON output, token budgeting, retry with backoff, CI exit codes and an offline mock mode.

## How this repo works

```bash
yarn today        # this week's POC and today's milestone
yarn start-week   # scaffold this week's POC folder
yarn ship         # log + commit + push today's work (refuses if nothing changed)
yarn test         # run tests for the Node POCs
```

The weekly plan lives in [`plan/plan.json`](plan/plan.json). Routine and conventions: [`ROUTINE.md`](ROUTINE.md).
