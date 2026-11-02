# 004 · Listings page with App Router, ISR and Server Actions

**Stack:** React / Next.js · **Week:** 2 · **Status:** in progress

## Problem
A property listings site needs fast, SEO-friendly pages that stay fresh without rebuilding on every change. This POC explores the Next.js App Router, ISR and Server Actions on top of a data layer that can later be swapped for a real database.

## What this POC shows
- Next.js App Router project (TypeScript, strict) with a server-rendered home page
- Typed mock listings JSON behind an async data-access module (`src/lib/listings.ts`)
- Unit tests for the data layer using the Node test runner

## Run
```bash
yarn install
yarn dev     # http://localhost:3000
yarn test    # data layer tests
yarn build

# scaffold reference (already applied by hand here):
# yarn create next-app . --ts --eslint --app --src-dir --use-yarn
```

## What I'd do in production
- Replace the JSON file with a database or API client behind the same async functions
- Validate data at the boundary (e.g. zod) instead of casting

## Interview talking points
- Why an async data layer even for mock data: callers don't change when the source does

## Daily plan
- [x] Mon: Create-next-app, mock listings JSON data source
- [ ] Tue: /listings server component with filters via searchParams
- [ ] Wed: /listings/[id] with generateStaticParams + revalidate (ISR)
- [ ] Thu: 'save listing' Server Action with optimistic UI (useOptimistic)
- [ ] Fri: Next/image, loading.tsx skeletons, Lighthouse before/after
- [ ] Sat: README on SSR vs SSG vs ISR decisions with numbers
- [ ] Sun: weekly review in DEVLOG.md
