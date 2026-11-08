# Devlog · 004


## Tue
- Scaffolded the app (the Monday step had not been done) with a mock listings JSON file
- Built `/listings` as a server component filtering by searchParams
- The scaffold enables Cache Components by default, which made the dynamic page fail to prerender; turned it off to use the classic caching model
- Node's built-in test runner with type stripping covers the filter logic, so no extra test dependency
- 2026-11-03 (W2 Tue): Add listings page with searchParams filters to Next.js POC

## Wed
- Added `/listings/[id]` with `generateStaticParams`, `revalidate = 60` and a `not-found` page; list cards now link to it
- Build output shows the 8 detail routes as SSG; a render timestamp makes regeneration visible
- JSON imports need an import attribute under Node's type stripping, so the id test reads the file directly
- 2026-11-04 (W2 Wed): Add listing detail page with generateStaticParams and ISR revalidate

## Thu
- Added a save/unsave Server Action with optimistic UI via `useOptimistic` on the listing cards
- Saved ids live in a cookie so there is no database yet; pure helpers for parsing and toggling are unit tested
- The action rejects unknown ids because Server Actions are directly callable
- 2026-11-05 (W2 Thu): Add save listing Server Action with optimistic UI

## Sat
- Wrote the SSR vs SSG vs ISR decision section in the README with a route table, decision rules and reproduce steps
- Measured p50/p95 over 50 requests per route on a production build; the numbers are localhost with mock data, so the README states what they do and do not show
- Cache headers (`s-maxage=60, stale-while-revalidate`) on the detail page versus `no-store` on the list page back up the mode of each route
- 2026-11-07 (W2 Sat): Document SSR vs SSG vs ISR decisions with measured numbers
- 2026-11-07 (W2 Sat): Document SSR vs SSG vs ISR decisions with measured numbers

## Sun
- Wrote the weekly review below and marked the POC done.

## Weekly review

### What worked
- The URL as the single source of truth for filters kept `/listings` a plain server component with no client state, and the no-JS GET form came for free.
- Parsing untrusted `searchParams` into a typed filter object at the boundary, with the matching logic as a pure function, made the unit tests small and fast.
- Picking the rendering mode per route (SSR for the list, ISR for detail, SSG for home) and confirming it from response headers rather than assuming it.
- Treating the Server Action as a public endpoint (validate the id against real listings, cap the cookie) kept the optimistic UI honest.
- Measuring before writing the SSR vs ISR guidance made the README state what the numbers do and do not prove.

### What I would change
- The Friday item (`next/image`, `loading.tsx` skeletons, Lighthouse before/after) was not built. It is the first thing to do next, with real before/after numbers.
- The data source is an in-memory JSON import, so SSR looks cheaper than it would against a database. Swap in a real query and re-measure.
- Saved listings live in a cookie. Move them to a per-user table behind auth.
- Add pagination and sorting through `searchParams`, and consider `dynamicParams` plus on-demand revalidation for a large catalogue.
- Add a component or e2e test for the save flow; today only the pure helpers are covered.

### Interview talking points
- Reading `searchParams` or cookies makes a route dynamic; ISR pages cannot read them, so personalisation belongs in a separate dynamic part.
- ISR serves cached HTML and regenerates at most once per `revalidate` window per page, so pick the window from tolerable staleness, not data change rate.
- Server Actions are public POST endpoints: validate input and authorise inside them.
- `useOptimistic` is temporary state; when the transition ends the server-rendered value wins, which doubles as the rollback.
- Localhost numbers show server work only; the structural gap between per-request data fetching and a cache hit is what matters at scale.
- 2026-11-08 (W2 Sun): Add weekly review for Next.js listings POC
