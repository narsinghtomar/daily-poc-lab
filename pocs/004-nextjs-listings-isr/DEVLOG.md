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
