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
- Optimistic like/unlike with TanStack Query (`src/likes/`): the heart and count change on tap, and a failed call rolls back on its own with a short "undone" banner
- The optimistic value is derived, not written: `useMutationState` reads the variables of pending like mutations and `applyPendingLikes` layers them over the server-confirmed list. When a call fails it stops being pending and the row falls back to server truth, so there is no snapshot to restore and refresh or paging mid-like cannot wipe the optimistic state
- The like endpoint is idempotent (`setLike({ postId, liked })`, i.e. PUT/DELETE, not a toggle) and returns the server's `{ likedByMe, likeCount }`, which is written into the list on success before the mutation stops being pending, so the row never flickers
- Mutations share a per-post `scope`, so rapid taps on one post reach the server one at a time in tap order while other posts still like in parallel; the UI always shows the latest tap
- Every 4th seeded post carries a photo (`media` with aspect ratio and placeholder colour), so the feed mixes two row layouts; the box is sized from the aspect ratio, so rows never jump when an image arrives
- `getItemType` (`src/feed/rowModel.ts`) gives photo and text posts separate recycle pools, so FlashList never recycles a text cell into a photo cell and re-lays it out
- Rows are memoized on what they draw, not on object identity: `samePostRow` compares the rendered fields, so the equal copies a refresh returns do not re-render any visible row
- Each row is split into a memoized content block (author, text, photo) and a like button, so a like tap re-renders only the button and the timestamp line
- `renderItem`, `keyExtractor` and `getItemType` are module-level functions, and one shared `Intl.DateTimeFormat` replaces a `toLocaleString` call per row (which builds a new formatter every time)
- A dev-only `ListProfiler` wraps the list in React's `Profiler` and logs commit stats (avg, p95, max, commits over the 16.7 ms frame budget) to the Metro console every 50 commits; it renders nothing extra in release builds
- Rollback is tested end to end without a device: the real mutation options run on a `QueryClient` against a hand-controlled fake server, covering success, failure, out-of-order taps, and "first tap saved, second failed"

## Run
```bash
yarn install    # scaffolded from: yarn create expo-app . --template blank-typescript
                # list added with: yarn add @shopify/flash-list
                # likes added with: yarn add @tanstack/react-query
yarn start      # then press a (Android) or i (iOS), or scan the QR code with Expo Go
yarn test       # cursor, pagination, feed state, like rollback, row model and perf stats tests (node:test, no device needed)
yarn typecheck
```

## Measuring performance
Run on a real mid-range Android device in a release-like build (`yarn expo start --no-dev --minify`); dev builds are several times slower and exaggerate every number.

1. Open the dev menu (shake, or `adb shell input keyevent 82`) and turn on **Perf Monitor**. It shows UI thread FPS, JS thread FPS and RAM.
2. Fling the feed from top to the end of all 120 posts and back, then tap like on a few rows while scrolling.
3. Watch for JS FPS dips below 60 and blank cells during fast flings. UI FPS dips point at native layout or images, JS FPS dips point at render work.
4. Re-run with the dev build and read the `[perf] feed:` lines in the Metro console for the JS side: average and p95 commit time and how many commits went over one frame.
5. To see the effect of today's changes, compare against a build with `getItemType` removed and `memo(PostRowImpl)` without the comparator: a pull to refresh should then re-render every visible row instead of none.

## What I'd do in production
- Back the endpoint with a composite index on `(created_at desc, id desc)` and a `WHERE (created_at, id) < ($1, $2)` row comparison, so each page is an index range scan regardless of depth
- Sign or encrypt the cursor if it must not leak sort values, and keep the version prefix so the format can change without breaking installed apps
- Map `INVALID_CURSOR` to a 400 and have the client reset to the first page; retry `NETWORK` errors with backoff
- Show a "N new posts" pill (poll a lightweight `GET /feed/head`) instead of relying only on pull to refresh, and keep scroll position when prepending
- Cache pages (TanStack Query infinite query) so the feed survives navigation and app restarts
- Retry like calls on `NETWORK` errors with backoff (safe because the call is idempotent), and persist paused mutations so a like made offline is sent when the app is back online
- Debounce or coalesce rapid taps on the same post so only the final intent is sent
- Push like counts from other users via a socket or periodic refetch instead of only on refresh
- Track scroll performance in the field (frozen and slow frames per screen, e.g. via a performance SDK) instead of relying only on local Perf Monitor runs
- Load real images with a cached image component (e.g. `expo-image`) and have the API return image dimensions so the placeholder box is exact
- Generate the client types from an OpenAPI schema instead of hand-writing them

## Interview talking points
- Why cursor over offset: offset is `O(offset)` in the database and shifts under inserts; a keyset cursor is stable and constant cost per page
- Why a tie-breaker: `createdAt` alone is not unique, so two posts in the same millisecond could be skipped or repeated at a page boundary
- Why `limit + 1`: tells you if another page exists in the same query, so the client knows when to stop without an extra round trip
- Why guard `onEndReached`: it can fire several times before state updates, so the hook keeps an in-flight ref and a request id instead of trusting render state
- Refresh vs load more race: refresh aborts the pending page and the reducer ignores any response whose request id is not the latest, so an old page never lands on a fresh list
- Why an opaque cursor: clients cannot build or depend on its contents, which keeps the server free to change the sort key later
- Snapshot rollback vs derived optimistic state: restoring a snapshot in `onError` breaks when taps overlap (the snapshot may itself be optimistic); deriving the UI from pending mutation variables makes rollback automatic and always lands on server truth
- Why `liked: boolean` instead of a toggle endpoint: a toggle is not idempotent, so a retry or a duplicated request flips the like back; a desired-state call can be repeated safely
- What `getItemType` buys: FlashList recycles cells instead of creating new ones; without types, a short text cell can be recycled into a tall photo post and has to rebuild and re-measure its whole subtree mid-scroll
- Why a custom `memo` comparator: default `memo` compares by reference, and a refresh returns new objects for unchanged posts, so every row re-renders; comparing drawn fields avoids that, at the cost of keeping the comparator in sync with the row
- Perf Monitor vs Profiler: Perf Monitor tells you frames are dropping and on which thread; the React Profiler tells you which component render work caused it
- Why a mutation `scope` per post: without it, like then unlike can reach the server out of order and the final state depends on network timing

## Daily plan
- [x] Mon: Expo app, mock paginated API (cursor based)
- [x] Tue: FlashList feed with cursor pagination + pull to refresh
- [x] Wed: Optimistic like/unlike with rollback on failure (TanStack Query)
- [x] Thu: Memoized rows, getItemType, measure with Perf Monitor
- [ ] Fri: Jest + RNTL tests for pagination and rollback
- [ ] Sat: README with FlatList vs FlashList comparison and screen recording
- [ ] Sun: weekly review in DEVLOG.md
