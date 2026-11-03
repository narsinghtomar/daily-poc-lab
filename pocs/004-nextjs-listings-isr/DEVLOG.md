# Devlog · 004


## Tue
- Scaffolded the app (the Monday step had not been done) with a mock listings JSON file
- Built `/listings` as a server component filtering by searchParams
- The scaffold enables Cache Components by default, which made the dynamic page fail to prerender; turned it off to use the classic caching model
- Node's built-in test runner with type stripping covers the filter logic, so no extra test dependency
- 2026-11-03 (W2 Tue): Add listings page with searchParams filters to Next.js POC
