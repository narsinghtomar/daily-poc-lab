# 001 · Node.js Rate Limiter

**Stack:** Node.js (no dependencies) · **Time-box:** 1 day

## Problem
Public APIs need protection from bursts and abusive clients. Which algorithm should you pick, and what are the trade-offs?

## What this POC shows
| Algorithm | Memory per key | Allows bursts | Boundary problem |
|---|---|---|---|
| Token bucket | 2 numbers | Yes, up to `capacity` | None |
| Sliding window counter | 3 numbers | No | Solved by weighting the previous window |

- Injectable clock, so tests are deterministic (no `setTimeout` in tests).
- Demo HTTP server returns standard `X-RateLimit-*` and `Retry-After` headers with `429`.

## Run
```bash
yarn test         # node --test, 6 tests
yarn start        # http://localhost:3000
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" localhost:3000; done
```

## What I'd do in production
- Move state to Redis (atomic Lua script or `INCR` + `EXPIRE`) so limits hold across instances.
- Key on API key / user id, not just IP (NAT and proxies share IPs).
- Different limits per route tier; cheaper reads, stricter writes and auth endpoints.
- Fail open vs fail closed decision if Redis is down.

## Interview talking points
- Why token bucket for user-facing APIs (tolerates bursts) vs sliding window for strict quotas.
- The fixed-window boundary burst and how the weighted estimate fixes it (see last-but-one test).
