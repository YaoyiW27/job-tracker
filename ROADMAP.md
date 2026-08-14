# Roadmap

Personal job-search app — **Track is the core; Discover is one optional feed
into it.** Source of truth for scope is `.private/SPEC.md`; this file tracks
build progress.

## Phases

### P0 — Foundation + ingest
- [x] **P0a** — Scaffold (Next.js/TS/Tailwind/shadcn/Prisma), schema, first migration
- [x] **P0b** — Port `find_jobs.py` location tagging → `location.ts` + `scope.ts` (+ parity check)
- [x] **P0c** — Pluggable ingest for both Simplify JSON repos (`npm run ingest`)
- [ ] **P0d** — Add speedyapply/2027-AI-College-Jobs source (markdown-table parser behind the seam) — _deferred: build after P1 (Track-first)_

### P1 — Tracker (CORE, stands alone)
- [ ] Manual **"Add row"** — first-class, primary entry point
- [ ] **URL-prefill helper** — paste a job URL → single on-demand fetch → pre-fill company + title (metadata-first: `<title>`/`og:title`/JSON-LD `JobPosting`, blank fallback; edit & save; not scraping)
- [ ] Editable TanStack table (inline status/notes/appliedDate)
- [ ] Statuses + duplicate warning
- [ ] Kanban board (drag to change status)

### P2 — Discover (a feed into the Tracker)
- [ ] Ranked read-only table over ingested jobs + filters (bucket, company, min fitScore, active-only, category, roleKind) + top-tier bump
- [ ] "Save to tracker" (creates an Application; warn on duplicate)

### P3 — Dashboard
- [ ] KPI cards (applied, in-progress, response rate, offers)
- [ ] Status donut/funnel
- [ ] Applications-over-time timeline
- [ ] Top companies

### P4 — Fit scorer (optional/pluggable)
- [ ] Claude-based scorer via `ANTHROPIC_API_KEY` (no key → skip)
- [ ] Store `fitScore` + `fitReason`; score on dataset metadata

### P5 — Future / optional (seams only for now)
- [ ] ATS sources (Greenhouse / Lever / Ashby) — deferred/optional
- [ ] Gmail status scan (bump `Application.status`)
- Explicitly out of scope: generic scraping of LinkedIn / Indeed

## Devlog

- 2026-08-14 — P0a: scaffolded Next 15 + Prisma/SQLite, initial migration, git init — `5984686`
- 2026-08-14 — P0b: ported location tagging (location.ts/scope.ts/scoring.ts) + parity check (15/15 vs Python) — `5a7d705`
- 2026-08-14 — P0c: pluggable ingest (source seam + normalizer + upsert); live run 4627 jobs, idempotent — `1c8481d`
