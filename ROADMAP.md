# Roadmap

Personal job-search app (Discover + Track). Source of truth for scope is
`.private/SPEC.md`; this file tracks build progress.

## Phases

### P0 — Foundation + Discover (read-only)
- [x] **P0a** — Scaffold (Next.js/TS/Tailwind/shadcn/Prisma), schema, first migration
- [ ] **P0b** — Port `find_jobs.py` location tagging → `location.ts` + `scope.ts` (+ parity check)
- [ ] **P0c** — Pluggable ingest for both Simplify repos (`npm run ingest`)
- [ ] **P0d** — Discover table (filters, sort, top-tier bump)

### P1 — Tracker
- [ ] Save-to-tracker (duplicate warning)
- [ ] Editable TanStack table (inline status/notes)
- [ ] Kanban board (drag to change status)
- [ ] Manual "Add row"

### P2 — Dashboard
- [ ] KPI cards (applied, in-progress, response rate, offers)
- [ ] Status donut/funnel
- [ ] Applications-over-time timeline
- [ ] Top companies

### P3 — Fit scorer (optional/pluggable)
- [ ] Claude-based scorer via `ANTHROPIC_API_KEY` (no key → skip)
- [ ] Store `fitScore` + `fitReason`; score on dataset metadata

### P4 — Future (seams only for now)
- [ ] Extra ATS sources (Greenhouse / Lever / Ashby)
- [ ] Gmail status scan (bump `Application.status`)

## Devlog

- 2026-08-14 — P0a: scaffolded Next 15 + Prisma/SQLite, initial migration, git init — `5984686`
