# Routine

**One POC per week. One real milestone per day. One commit per milestone.**
12 weeks, 5 stacks (Flutter ×3, Node.js ×3, React/Next.js ×2, React Native ×2, AI/LLM ×2), starting Mon 26 Oct 2026.

## Daily (30 to 45 min)

| When | What | Command |
|---|---|---|
| Morning, 2 min | See today's milestone | `yarn today` |
| Evening, 30 to 40 min | Build only that milestone. Stop when it works. | |
| End, 2 min | Log, commit, push | `yarn ship` (or `yarn ship "Your custom message"`) |
| 20:30 | Mac reminder fires **only if** you haven't committed | auto |

Busy day? Do the smallest honest slice: one test, one edge case, one README section. That still counts.

## Weekly shape

| Day | Milestone type | Example commit |
|---|---|---|
| Mon | Setup / scaffold | `Flutter create, add riverpod + hive` |
| Tue | Core feature | `Task model + Hive repository` |
| Wed | Second feature / UI | `Providers + list UI` |
| Thu | Tests or hard part | `Repository + widget tests` |
| Fri | Advanced bit / perf | `Sync queue with retry` |
| Sat | README, diagram, screenshots | `Architecture + trade-offs` |
| Sun | Weekly review in DEVLOG.md | `Weekly review` |

Monday of each week: `yarn start-week`, then run the `init` command it prints.

## 12-week plan

| Week | Dates | POC | Title | Stack |
|---|---|---|---|---|
| 1 | 26 Oct – 1 Nov | 003 | Offline-first task app (Riverpod + Hive) | Flutter |
| 2 | 2 Nov – 8 Nov | 004 | Listings page with App Router, ISR and Server Actions | React / Next.js |
| 3 | 9 Nov – 15 Nov | 005 | Idempotency keys + transactional outbox | Node.js |
| 4 | 16 Nov – 22 Nov | 006 | Infinite feed with FlashList and optimistic likes | React Native |
| 5 | 23 Nov – 29 Nov | 007 | RAG over markdown docs with citations | AI / LLM |
| 6 | 30 Nov – 6 Dec | 008 | BLoC auth flow with token refresh interceptor | Flutter |
| 7 | 7 Dec – 13 Dec | 009 | Background jobs with BullMQ: retries, DLQ, rate limit | Node.js |
| 8 | 14 Dec – 20 Dec | 010 | 100k-row table: virtualization + Web Worker | React |
| 9 | 21 Dec – 27 Dec | 011 | Offline mutation queue with NetInfo + MMKV | React Native |
| 10 | 28 Dec – 3 Jan | 012 | Tool-calling agent over a small REST API | AI / LLM |
| 11 | 4 Jan – 10 Jan | 013 | CustomPainter charts + golden tests | Flutter |
| 12 | 11 Jan – 17 Jan | 014 | Realtime notifications with SSE | Node.js + Next.js |

Day-by-day milestones for every week are in [`plan/plan.json`](plan/plan.json). Edit freely; the scripts read from it. To shift the whole plan, change `startDate`.

## Rules

1. **No empty, fake or backdated commits.** `ship` refuses when nothing changed. An interviewer who opens a green square should find real code.
2. **Small commits, plain clear messages** (e.g. "Add retry with backoff to sync queue").
3. **Every POC README answers:** problem, what it shows, how to run, production changes, talking points.
4. **Time-box.** If a milestone runs over, cut scope, don't skip the commit.
5. **Missed a day?** Fine. Continue from today's milestone; don't fake the gap.

## One-time setup

```bash
# 1. Create an empty public repo on GitHub named daily-poc-lab (no README)
# 2. In the unzipped folder:
git init -b main
git add -A
git commit -m "Bootstrap POC lab with rate limiter and AI diff reviewer"
git remote add origin git@github.com:<your-username>/daily-poc-lab.git
git push -u origin main

# 3. Daily reminder on your Mac (20:30; change with: ./scripts/install-reminder-macos.sh 21 0)
chmod +x scripts/*.sh
./scripts/install-reminder-macos.sh

# 4. Pin the repo on your GitHub profile
```

Make sure the email in `git config user.email` is added to your GitHub account, or commits won't show on your contribution graph.

## How to talk about it in the interview

> "I run a weekly POC routine across the stacks my team uses. Each week I pick one engineering question, like rate limiting strategy or offline sync conflicts, build the smallest thing that answers it, and write up the trade-offs. Happy to walk you through any of them."

Then open one POC README and its tests. Pick 001 (backend depth) or 002 (AI in the SDLC) first.
