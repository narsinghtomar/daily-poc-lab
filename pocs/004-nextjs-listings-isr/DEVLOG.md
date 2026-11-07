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
