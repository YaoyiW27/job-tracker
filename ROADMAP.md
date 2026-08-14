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
