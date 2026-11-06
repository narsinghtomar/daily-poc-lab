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
- Cards and the detail page use `next/image` with statically imported photos: width/height and a blur placeholder come from the import, `sizes` lets the browser pick a right-sized variant, the first three cards use `priority` and the rest lazy-load
- `loading.tsx` for `/listings` and `/listings/[id]` shows skeletons that reuse the real grid and 3:2 aspect ratio, so content swaps in without layout shift
- Set `LISTINGS_LATENCY_MS=800` to simulate database latency and see the skeletons in dev

## Lighthouse (desktop preset, performance, local `yarn build && yarn start`, median of 3)
| | Score | LCP | CLS | Transferred |
|---|---|---|---|---|
| Before (text-only cards) | 100 | 0.54 s | 0 | 215 KB |
| After (`next/image`, skeletons) | 100 | 0.54 s | 0 | 257 KB |

Honest reading: the "before" page had no images, so this shows that adding eight-ish photos costs about 40 KB with no CLS and no LCP regression, not a speed-up. Localhost with a tiny dataset also saturates the score; a throttled mobile run against real photos is the meaningful comparison. Reproduce with:
```bash
yarn global add lighthouse
lighthouse http://localhost:3000/listings --only-categories=performance --preset=desktop --chrome-flags="--headless" --view
```

## Run
```bash
yarn install
yarn dev        # http://localhost:3000/listings?city=Berlin&type=apartment&maxPrice=1500
yarn test       # unit tests for filter parsing and matching
yarn build && yarn start
node scripts/generate-images.mjs   # regenerates the placeholder photos in src/assets
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

- `next/image` serves resized AVIF/WebP-capable variants from `/_next/image`; static imports avoid specifying dimensions by hand and prevent CLS
- `priority` is only for the LCP candidates; marking everything priority defeats lazy-loading
- `loading.tsx` is a Suspense boundary around the page, so the shell streams first; skeletons should match final dimensions
- Lighthouse on localhost is a smoke test; use throttled mobile runs and field data (CrUX) for real decisions

## Daily plan
- [ ] Mon: Create-next-app, mock listings JSON data source
- [x] Tue: /listings server component with filters via searchParams
- [x] Wed: /listings/[id] with generateStaticParams + revalidate (ISR)
- [x] Thu: 'save listing' Server Action with optimistic UI (useOptimistic)
- [x] Fri: Next/image, loading.tsx skeletons, Lighthouse before/after
- [ ] Sat: README on SSR vs SSG vs ISR decisions with numbers
- [ ] Sun: weekly review in DEVLOG.md
