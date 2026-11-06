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

## Fri
- Added `next/image` with generated placeholder photos (zero-dependency PNG script) and `loading.tsx` skeletons for the list and detail routes
- Lighthouse before/after was flat (100 both, CLS 0) because the baseline had no images; recorded that honestly in the README instead of claiming a win
- Added an opt-in latency env var so skeletons can be seen locally
- 2026-11-06 (W2 Fri): Add next/image photos and loading skeletons to Next.js listings POC
