# 004 · Listings page with App Router, ISR and Server Actions

**Stack:** React / Next.js · **Week:** 2 · **Status:** in progress

## Problem
Property search needs shareable, bookmarkable filter state and fast first paint. Keeping filters in the URL and rendering on the server gives both without client-side state libraries.

## What this POC shows
- `/listings` is a server component that reads `searchParams` (a Promise in this Next.js version) and filters a mock JSON data source
- Filters (city, type, min bedrooms, max price) live in the URL via a plain GET form, so it works without client JS
- Untrusted query params are parsed into a typed filter object; invalid values are dropped instead of throwing
- Filtering logic is a pure function covered by unit tests
- `/listings/[id]` is pre-rendered with `generateStaticParams` and regenerated in the background with `revalidate = 60` (ISR); unknown ids return a 404 via `notFound()`
- Each listing card has a Save button backed by a Server Action (`setListingSaved`); `useOptimistic` flips the star instantly and React rolls it back if the action throws
- Saved ids are stored per visitor in an httpOnly cookie, parsed defensively and capped; the action validates the id against real listings before writing

## Run
```bash
yarn install
yarn dev        # http://localhost:3000/listings?city=Berlin&type=apartment&maxPrice=1500
yarn test       # unit tests for filter parsing and matching
yarn build && yarn start
```

## SSR vs SSG vs ISR: which route uses what, and why

| Route | Mode | Why |
|-------|------|-----|
| `/listings` | SSR (dynamic) | Output depends on `searchParams` and the saved-ids cookie, so it cannot be cached across visitors |
| `/listings/[id]` | SSG + ISR (`revalidate = 60`) | Same HTML for everyone, changes rarely, high read volume |
| `/` | SSG | Fully static, no data |

### Measured numbers
Production build (`yarn build && yarn start`, Next.js 16.4.4), 50 sequential `curl` requests per URL against localhost on a 4-core container, mock JSON data (8 listings, about 1 KB):

| URL | Mode | p50 | p95 | HTML size |
|-----|------|-----|-----|-----------|
| `/` | SSG | 1.5 ms | 2.0 ms | 5.7 KB |
| `/listings/l-001` | ISR (cache hit) | 1.6 ms | 3.8 ms | 9.1 KB |
| `/listings` | SSR, no filter | 5.3 ms | 10.8 ms | 16.6 KB |
| `/listings?city=Berlin&type=apartment` | SSR, filtered | 4.3 ms | 7.6 ms | 11.7 KB |

Response headers confirm the modes: the detail page sends `Cache-Control: s-maxage=60, stale-while-revalidate=31535940` with `x-nextjs-cache: HIT`, while `/listings` sends `private, no-cache, no-store`.

How to read these numbers:
- They measure server work only. There is no network, TLS or CDN hop, and the data source is an in-memory JSON import, so SSR looks cheap here.
- The gap that matters is structural, not the 3-4 ms difference. An SSR request pays for its data source on every hit; an ISR hit pays for none of it. With a real database at, say, 20-50 ms per query (an assumption, not measured here), SSR p50 becomes roughly that plus render time, while the ISR hit stays flat.
- Build cost is the other side of the trade: 8 detail pages are generated in a few milliseconds per page here (the whole static generation step took 323 ms). At 100k listings, pre-rendering everything at build time stops being practical, which is where `dynamicParams` plus on-demand caching helps.

### Decision rules
1. Output depends on the request (query string, cookies, headers, auth)? **SSR**. Keep the data fetch cheap and index the query.
2. Same output for everyone and it never changes between deploys? **SSG**.
3. Same output for everyone but the data changes? **ISR**. Pick `revalidate` from how stale you can tolerate, not from how often data changes. 60 s means at most one regeneration per minute per page regardless of traffic.
4. Large catalogue? Pre-render only the popular ids in `generateStaticParams` and leave `dynamicParams = true` so the long tail renders once on first request, then is cached.
5. Mostly static page with one personalised bit? Keep the page static and fetch the personal part on the client or in a separate dynamic segment, rather than making the whole route SSR.

### Reproduce
```bash
yarn build && PORT=3111 yarn start &
for i in $(seq 1 50); do curl -s -o /dev/null -w "%{time_total}\n" http://localhost:3111/listings/l-001; done | sort -n
curl -sI http://localhost:3111/listings/l-001 | grep -i -E "cache-control|x-nextjs-cache"
```

## What I'd do in production
- Replace the JSON file with a database query and push filtering into SQL with indexes
- Add pagination and sorting, also driven by searchParams
- Store saved listings per user in a database instead of a cookie, and require auth for the action
- Debounce/enhance the form progressively for instant filtering while keeping the no-JS fallback

## Interview talking points
- Using `searchParams` makes the route dynamic (rendered per request); static or ISR pages cannot read it
- URL as the source of truth: shareable, back-button friendly, no state sync bugs
- Validate and normalise all external input at the boundary
- ISR: serve the cached HTML instantly, re-render at most once per `revalidate` window; the footer timestamp on the detail page shows when it was generated (check with `yarn build && yarn start`)
- `dynamicParams = true` lets ids missing at build time render on first request and then get cached
- Server Actions are public POST endpoints: validate input and authorise inside the action, never trust the client
- `useOptimistic` state is temporary: it lasts for the duration of the action's transition, then the server-rendered prop wins (which is also the rollback on error)
- Cookies make `/listings` dynamic, which it already was because of `searchParams`; the ISR detail page deliberately does not read them
- Cache Components is switched off in `next.config.ts` so the classic `revalidate` ISR model can be demonstrated on the detail page later in the week

## Daily plan
- [ ] Mon: Create-next-app, mock listings JSON data source
- [x] Tue: /listings server component with filters via searchParams
- [x] Wed: /listings/[id] with generateStaticParams + revalidate (ISR)
- [x] Thu: 'save listing' Server Action with optimistic UI (useOptimistic)
- [ ] Fri: Next/image, loading.tsx skeletons, Lighthouse before/after
- [x] Sat: README on SSR vs SSG vs ISR decisions with numbers
- [ ] Sun: weekly review in DEVLOG.md
