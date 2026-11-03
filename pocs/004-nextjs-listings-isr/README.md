# 004 · Listings page with App Router, ISR and Server Actions

**Stack:** React / Next.js · **Week:** 2 · **Status:** in progress

## Problem
Property search needs shareable, bookmarkable filter state and fast first paint. Keeping filters in the URL and rendering on the server gives both without client-side state libraries.

## What this POC shows
- `/listings` is a server component that reads `searchParams` (a Promise in this Next.js version) and filters a mock JSON data source
- Filters (city, type, min bedrooms, max price) live in the URL via a plain GET form, so it works without client JS
- Untrusted query params are parsed into a typed filter object; invalid values are dropped instead of throwing
- Filtering logic is a pure function covered by unit tests

## Run
```bash
yarn install
yarn dev        # http://localhost:3000/listings?city=Berlin&type=apartment&maxPrice=1500
yarn test       # unit tests for filter parsing and matching
yarn build && yarn start
```

## What I'd do in production
- Replace the JSON file with a database query and push filtering into SQL with indexes
- Add pagination and sorting, also driven by searchParams
- Debounce/enhance the form progressively for instant filtering while keeping the no-JS fallback

## Interview talking points
- Using `searchParams` makes the route dynamic (rendered per request); static or ISR pages cannot read it
- URL as the source of truth: shareable, back-button friendly, no state sync bugs
- Validate and normalise all external input at the boundary
- Cache Components is switched off in `next.config.ts` so the classic `revalidate` ISR model can be demonstrated on the detail page later in the week

## Daily plan
- [ ] Mon: Create-next-app, mock listings JSON data source
- [x] Tue: /listings server component with filters via searchParams
- [ ] Wed: /listings/[id] with generateStaticParams + revalidate (ISR)
- [ ] Thu: 'save listing' Server Action with optimistic UI (useOptimistic)
- [ ] Fri: Next/image, loading.tsx skeletons, Lighthouse before/after
- [ ] Sat: README on SSR vs SSG vs ISR decisions with numbers
- [ ] Sun: weekly review in DEVLOG.md
