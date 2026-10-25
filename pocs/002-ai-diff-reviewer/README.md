# 002 · AI Diff Reviewer

**Stack:** Node.js + Claude API (no SDK, no dependencies) · **Time-box:** 1 day

## Problem
PR reviews are slow and inconsistent. Can an LLM give a useful first pass on a diff, in a form a CI pipeline can act on?

## What this POC shows
- **Structured output:** the model must return JSON (summary, risk, findings, commit message); the parser strips code fences and validates every field before use.
- **Token budgeting:** lockfiles and generated files are filtered out; large diffs are truncated on a file boundary.
- **Resilience:** retries only on `429`/`5xx` with exponential backoff and jitter; `4xx` fails fast.
- **CI-ready:** `--fail-on-high` exits `2` if any high-severity finding exists.
- **Offline mock mode:** demo works in an interview with no key and no network.

## Run
```bash
yarn test                             # 8 tests, network is mocked
yarn demo                             # offline review of sample.diff
export ANTHROPIC_API_KEY=...          # real model
git add -p && yarn review             # review your staged changes
```

## What I'd do in production
- Post findings as inline PR comments via the GitHub API (GitHub Action).
- Split very large diffs per file and review in parallel, then merge results.
- Track false-positive rate; treat the LLM as advisory, never as the merge gate alone.
- Never send secrets-bearing files; add a pre-filter for `.env` and key patterns.

## Interview talking points
- Why validate LLM output like any untrusted input.
- Cost and latency control: filtering, truncation, small max_tokens.
- Where AI fits in the SDLC: first-pass review, commit messages, test gap hints.
