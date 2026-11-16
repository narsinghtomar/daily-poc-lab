# 006 · Infinite feed with FlashList, pagination and optimistic likes

**Stack:** React Native · **Week:** 4 · **Status:** in progress

## Problem
Social and marketplace feeds load in pages while new items keep arriving at the top. Offset pagination repeats or skips rows when that happens, and long lists drop frames on mid-range phones. This POC builds a feed that pages correctly under inserts and stays smooth as it grows.

## What this POC shows
- Expo (SDK 58, TypeScript) app with a mock `GET /feed?cursor=&limit=` API behind a small `FeedApi` interface, so the real HTTP client can replace it without touching screens
- Keyset (cursor) pagination on `(createdAt desc, id desc)`: the cursor is the sort key of the last row, so posts published mid-scroll never cause duplicates on the next page, and a deleted cursor row does not break paging
- Opaque, versioned, base64url cursor; malformed or unknown-version cursors are rejected with a typed `INVALID_CURSOR` error instead of silently returning page one
- Server-side limit clamping (default 20, max 50) and a `limit + 1` read to detect the last page without a `COUNT` query
- Configurable latency and failure rate, plus `AbortSignal` support, so loading, error and cancel paths are exercised from day one
- Deterministic seeded dataset (120 posts, some sharing a timestamp to test the tie-breaker); returned posts are copies so UI code cannot mutate the store
- Day 1 screen is a plain list with a "Load more" / "Retry" button that proves the API end to end; the virtualized feed replaces it next

## Run
```bash
yarn install    # scaffolded from: yarn create expo-app . --template blank-typescript
yarn start      # then press a (Android) or i (iOS), or scan the QR code with Expo Go
yarn test       # cursor + pagination tests (node:test, no device needed)
yarn typecheck
```

## What I'd do in production
- Back the endpoint with a composite index on `(created_at desc, id desc)` and a `WHERE (created_at, id) < ($1, $2)` row comparison, so each page is an index range scan regardless of depth
- Sign or encrypt the cursor if it must not leak sort values, and keep the version prefix so the format can change without breaking installed apps
- Map `INVALID_CURSOR` to a 400 and have the client reset to the first page; retry `NETWORK` errors with backoff
- Generate the client types from an OpenAPI schema instead of hand-writing them

## Interview talking points
- Why cursor over offset: offset is `O(offset)` in the database and shifts under inserts; a keyset cursor is stable and constant cost per page
- Why a tie-breaker: `createdAt` alone is not unique, so two posts in the same millisecond could be skipped or repeated at a page boundary
- Why `limit + 1`: tells you if another page exists in the same query, so the client knows when to stop without an extra round trip
- Why an opaque cursor: clients cannot build or depend on its contents, which keeps the server free to change the sort key later

## Daily plan
- [x] Mon: Expo app, mock paginated API (cursor based)
- [ ] Tue: FlashList feed with cursor pagination + pull to refresh
- [ ] Wed: Optimistic like/unlike with rollback on failure (TanStack Query)
- [ ] Thu: Memoized rows, getItemType, measure with Perf Monitor
- [ ] Fri: Jest + RNTL tests for pagination and rollback
- [ ] Sat: README with FlatList vs FlashList comparison and screen recording
- [ ] Sun: weekly review in DEVLOG.md
