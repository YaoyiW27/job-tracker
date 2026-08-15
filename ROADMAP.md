# Roadmap

Personal job-search app — **Track is the core; Discover is one optional feed
into it.** Source of truth for scope is `.private/SPEC.md`; this file tracks
build progress.

**Process:** plan-first → phase-by-phase with approval → tick box + devlog per
sub-step. **Scoped TDD:** pure logic/lib is test-first; UI is implement-then-cover.
All phase verification lands as repeatable tests in `tests/` (Vitest, `npm test`).

## Testing
- [x] Vitest + `tests/` + `npm test` set up
- [x] Backfill: location tagging (+ parity vs `find_jobs.py`), scope + auth flags, dedupe case-insensitivity, prefill (SSRF refusals + JSON-LD/og/title extraction) — 47 tests

## Phases

### P0 — Foundation + ingest
- [x] **P0a** — Scaffold (Next.js/TS/Tailwind/shadcn/Prisma), schema, first migration
- [x] **P0b** — Port `find_jobs.py` location tagging → `location.ts` + `scope.ts` (+ parity check)
- [x] **P0c** — Pluggable ingest for both Simplify JSON repos (`npm run ingest`)
- [ ] **P0d** — Add speedyapply/2027-AI-College-Jobs source (markdown-table parser behind the seam) — _deferred: build after P1 (Track-first)_

### P1 — Tracker (CORE, stands alone)
- [x] **P1a** — API + data layer: applications CRUD (`/api/applications`), case-insensitive dedupe (warn, don't block), URL-prefill service (`/api/prefill`, metadata-first + SSRF guards)
- [x] **P1b** — Manual **"Add row"** dialog (primary entry point) with URL-prefill field; duplicate-warning flow
- [x] **P1c** — Editable TanStack table (inline status/notes/appliedDate)
- [x] **P1d** — Kanban board (drag to change status); table/board toggle

### P2 — Discover (a feed into the Tracker)
- [x] **P2a** — Jobs query layer (parse filters + Prisma where/orderBy) + `/api/jobs`
- [x] **P2b** — Ranked Discover table + filters (bucket, company, min fitScore, active-only, category, roleKind) + top-tier bump
- [x] **P2c** — "Save to tracker" (creates an Application; warn on duplicate)

### P3 — Dashboard
- [x] KPI cards (applied, in-progress, response rate, offers)
- [x] Status distribution (horizontal bar — clearer than a 7-slice donut per dataviz)
- [x] Applications-over-time (cumulative area)
- [x] Top companies (bar)

### P4 — Fit scorer (optional/pluggable)
- [x] Claude-based scorer via `ANTHROPIC_API_KEY` (no key → skip); `npm run score`
- [x] Store `fitScore` + `fitReason`; score on dataset metadata; dual-resume A/B pick

### P5 — Future / optional (seams only for now)
- [ ] ATS sources (Greenhouse / Lever / Ashby) — deferred/optional
- [ ] Gmail status scan (bump `Application.status`)
- Explicitly out of scope: generic scraping of LinkedIn / Indeed

### P6 — Interview-prep (FUTURE / optional — placeholder, do NOT build now)
- [ ] Company research, STAR stories, likely Q&A
- Note: if ever built, reimplement prompts with **Claude**. Do NOT use
  `career-prep-agent`'s code — it has **no license**. Inspiration only.

### P7 — Harden access (FUTURE — do when there is time)

Today the deployment is gated by `APP_PASSWORD` in `src/middleware.ts`: HTTP
Basic, one shared password, any username. That is the right size for a
single-user tracker, but it has known weak spots, and they matter more if this
repo ever goes public — the code does not leak the password, but it does tell a
reader exactly what the only barrier is, and the README names the URL.

What is actually weak, worst first:

- [ ] **No rate limiting.** Nothing stops an attacker trying passwords as fast
      as the network allows. This is the one that turns a mediocre password into
      a breach. Needs a shared store to count attempts (Vercel KV / Upstash);
      middleware alone cannot hold state across edge invocations.
- [ ] **The password is the whole barrier** — no second factor, no session, no
      account. Basic auth also re-sends it on every single request (encrypted by
      HTTPS, but a wide exposure surface).
- [ ] **Comparison is not constant-time** (`provided === password`). Marginal
      over a network, but free to fix.
- [ ] **No sign-out and no rotation story.** Changing the password means editing
      an env var and redeploying.

Options, cheapest first:

1. **A long random `APP_PASSWORD`** — no code, and it defeats the brute force
   that the missing rate limit would otherwise allow. Do this regardless.
2. **Vercel Authentication** (project → Deployment Protection) — access requires
   being logged into the Vercel account that owns the project. Free, no code,
   and strictly stronger than a shared password. Costs you a Vercel login on
   each new device.
3. **GitHub OAuth via Auth.js, allow-listing one account** — nothing to crack,
   proper sessions, and sign-out. The most work; the right answer if this ever
   holds anything beyond a job list.

Do NOT go public with the repo before deciding: see the privacy notes in the
session where this was written — the scorer prompt encodes personal criteria,
and `scope.ts` states an immigration constraint.

## Devlog

- 2026-08-14 — P0a: scaffolded Next 15 + Prisma/SQLite, initial migration, git init — `5984686`
- 2026-08-14 — P0b: ported location tagging (location.ts/scope.ts/scoring.ts) + parity check (15/15 vs Python) — `5a7d705`
- 2026-08-14 — P0c: pluggable ingest (source seam + normalizer + upsert); live run 4627 jobs, idempotent — `1c8481d`
- 2026-08-14 — reprioritized to Track-first; speedyapply source deferred to P0d; manual-add + URL-prefill elevated — `552baf0`
- 2026-08-14 — P1a: applications API (CRUD + dedupe) + URL-prefill service; verified end-to-end via dev server — `3b318a3`
- 2026-08-14 — Testing: Vitest + `tests/` + scoped-TDD rule (SPEC/CLAUDE); backfilled 47 tests for P0–P1a pure logic — `f1521f1`
- 2026-08-14 — P1b: Tracker page + Add-row dialog (URL-prefill + dup-warning); draft/prefill/interpret logic test-first (15 tests, 62 total); hand-rolled shadcn-style UI primitives (no Radix) — `1b3857a`
- 2026-08-14 — P1c: inline-editable TanStack table (v8; pinned off unstable v9) + delete; client-owned Tracker state; patch-diff logic test-first (10 tests, 72 total) — `bf5744b`
- 2026-08-14 — P1d: Kanban board (native drag-to-change-status) + table/board toggle; group/move logic test-first (5 tests, 77 total). P1 complete — `8a6b4fd`
- 2026-08-14 — P2a: jobs query layer (parse filters + where/orderBy) test-first + `/api/jobs`; verified vs 4627 ingested jobs (12 tests, 89 total) — `545b7b6`
- 2026-08-14 — P2b: Discover page (ranked table + filters + pagination) + global nav — `5facf0e`
- 2026-08-14 — P2c: Save-to-tracker from Discover; job→app mapping test-first; fixed 500 on force-saving an already-linked job (1:1 jobId) → clean 409 (93 tests). P2 complete — `b3a0708`
- 2026-08-14 — P3: Dashboard — KPI cards + Recharts (by-status, cumulative over-time, top companies); metrics math test-first (8 tests, 101 total); dataviz single-series palette. P3 complete — `2f8b4af`
- 2026-08-14 — P4: pluggable Claude fit scorer (opus-5, structured output, refusal-safe, no-key skip) + dual-resume A/B; LaTeX/prompt/normalize logic test-first (14 tests, 115 total). P4 complete — `0b2a4dc`
- 2026-08-14 — chore: score script auto-loads .env (tsx); verified empty-tracker app run across all pages — `fb44521`
- 2026-08-14 — fix: US/Vancouver location bug — ambiguous cities (Richmond/Vancouver/Surrey) now disambiguated by state/province; word-boundary US-state detection; re-ingest cut US-in-Vancouver mislabels 22→0 (10 new location tests) — `815f895`
- 2026-08-14 — feat: freshness as a separate signal — recencyTier + Discover Fit/Newest sort toggle + Fresh badge (fitScore untouched); 10 tests — `815f895`
- 2026-08-14 — fix: scorer dropped unsupported `effort` param (Haiku 400) + scoreJob skip-safe on API error; live run 20 scored/0 skipped (133 tests) — `815f895`
