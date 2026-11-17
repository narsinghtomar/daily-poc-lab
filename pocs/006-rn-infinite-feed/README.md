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
- Virtualized feed with `@shopify/flash-list` v2: next page loads as the user nears the bottom (`onEndReached`, threshold 0.5), pull to refresh fetches the newest first page, with footer spinner, end-of-feed marker, empty state and inline retry
- Pagination state lives in a pure reducer (`src/feed/feedReducer.ts`) with three load kinds (`initial`, `more`, `refresh`), so the rules are unit tested without a device
- One request at a time: repeated `onEndReached` calls are ignored while a page is in flight, a refresh aborts a pending page, and a request id on every response drops late (stale) pages
- Rows are de-duplicated by id when pages are appended; a failed page stops auto paging (no retry loop on scroll) until the user taps Retry; a failed refresh keeps the current list and shows a banner
- An `INVALID_CURSOR` on a page request resets the feed to the top instead of getting stuck
- A dev ticker publishes a new post every 10 s, so pull to refresh visibly brings in fresh posts

## Run
```bash
yarn install    # scaffolded from: yarn create expo-app . --template blank-typescript
                # list added with: yarn add @shopify/flash-list
yarn start      # then press a (Android) or i (iOS), or scan the QR code with Expo Go
yarn test       # cursor, pagination and feed state tests (node:test, no device needed)
yarn typecheck
```

## What I'd do in production
- Back the endpoint with a composite index on `(created_at desc, id desc)` and a `WHERE (created_at, id) < ($1, $2)` row comparison, so each page is an index range scan regardless of depth
- Sign or encrypt the cursor if it must not leak sort values, and keep the version prefix so the format can change without breaking installed apps
- Map `INVALID_CURSOR` to a 400 and have the client reset to the first page; retry `NETWORK` errors with backoff
- Show a "N new posts" pill (poll a lightweight `GET /feed/head`) instead of relying only on pull to refresh, and keep scroll position when prepending
- Cache pages (TanStack Query infinite query) so the feed survives navigation and app restarts
- Generate the client types from an OpenAPI schema instead of hand-writing them

## Interview talking points
- Why cursor over offset: offset is `O(offset)` in the database and shifts under inserts; a keyset cursor is stable and constant cost per page
- Why a tie-breaker: `createdAt` alone is not unique, so two posts in the same millisecond could be skipped or repeated at a page boundary
- Why `limit + 1`: tells you if another page exists in the same query, so the client knows when to stop without an extra round trip
- Why guard `onEndReached`: it can fire several times before state updates, so the hook keeps an in-flight ref and a request id instead of trusting render state
- Refresh vs load more race: refresh aborts the pending page and the reducer ignores any response whose request id is not the latest, so an old page never lands on a fresh list
- Why an opaque cursor: clients cannot build or depend on its contents, which keeps the server free to change the sort key later

## Daily plan
- [x] Mon: Expo app, mock paginated API (cursor based)
- [x] Tue: FlashList feed with cursor pagination + pull to refresh
- [ ] Wed: Optimistic like/unlike with rollback on failure (TanStack Query)
- [ ] Thu: Memoized rows, getItemType, measure with Perf Monitor
- [ ] Fri: Jest + RNTL tests for pagination and rollback
- [ ] Sat: README with FlatList vs FlashList comparison and screen recording
- [ ] Sun: weekly review in DEVLOG.md
