# Job Tracker

A local-first personal web app for a new-grad / early-career software job search.
It does two things:

- **Track (the core)** — a Notion-style, inline-editable table + Kanban board + a
  dashboard for everything you're applying to and where each application stands.
  Works fully on its own; **manually adding a row is the primary way in** (paste a
  job URL and it pre-fills company + title).
- **Discover (one feed into the tracker)** — pulls new-grad/intern postings from
  public datasets, tags each by location fit + work-authorization flags, ranks
  them, and lets you save any row to the tracker in one click. An optional
  AI **fit scorer** rates jobs 0–100 against your preferences.

It is **not** an auto-apply or form-autofill tool.

## Stack

Next.js (App Router) + TypeScript · Tailwind CSS v4 · SQLite via Prisma ·
TanStack Table · Recharts · Vitest. One runtime, one `npm run dev`. No accounts,
no external database.

## Requirements

- Node.js ≥ 20 (developed on 24)
- npm

## Quick start

```bash
git clone <your-repo-url> job-tracker
cd job-tracker
npm install

# 1. create the local SQLite database (prisma/dev.db)
npm run db:migrate

# 2. pull jobs into the Discover feed (optional, but populates Discover)
npm run ingest

# 3. run the app
npm run dev
```

Open **http://localhost:3000** — it lands on the Tracker. Use the top nav to
switch between **Tracker**, **Discover**, and **Dashboard**.

The app runs fine with an empty tracker and even with no ingested jobs — every
step above except `db:migrate` is optional.

## The three pages

### Tracker (`/tracker`) — the core
- **+ Add row** — the main entry point. Paste a job URL and click **Prefill**:
  it does a single fetch of that page and fills in company + title (from JSON-LD /
  OpenGraph / `<title>`), which you edit and save. Or just type it in. Warns on
  duplicates.
- **Table view** — inline-edit status, notes, applied date, salary, etc.; sortable
  columns.
- **Board view** — Kanban grouped by status; drag a card to change its status.

### Discover (`/discover`) — a feed into the tracker
- Ranked table of ingested jobs: fit bucket, fit score, company (★ = top-tier),
  title, location, freshness, salary, work-auth flags, apply link.
- **Filters**: location bucket, company, category, role kind (new-grad / intern),
  min fit score, active-only, in-scope-only.
- **Sort toggle**: **Fit** (location + fit score) or **Newest** (most recent
  first). Freshness is a separate signal — it never changes the fit score.
- **Save** — one click creates a tracker application (warns if already saved).

### Dashboard (`/dashboard`)
KPI cards (applied, in-progress, response rate, offers) plus charts: applications
by status, cumulative applications over time, and top companies.

## Location tagging

Each ingested job is bucketed by how well its location fits, best → worst:
`VANCOUVER → CANADA_REMOTE → REMOTE_GENERIC → CANADA_OTHER → US_REMOTE →
US_ONSITE → OTHER`, with a top-tier-company rank bump. US-remote and
generic-remote rows are flagged "verify work authorization / Canada-eligible".
Ambiguous city names are disambiguated by state/province (e.g. *Richmond, VA* →
US, *Richmond, BC* → Vancouver). Nothing is dropped — out-of-scope rows are kept,
flagged, and demoted.

## Optional: AI fit scorer

Scores each job 0–100 with a one-line reason, using Claude. **Entirely optional** —
with no API key the app runs normally, jobs just have no score.

1. Put your key in `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   # optional model override (default claude-opus-5)
   ANTHROPIC_MODEL=claude-haiku-4-5
   ```
2. Score jobs:
   ```bash
   npm run score -- --limit 20     # score up to 20 unscored, in-scope jobs
   npm run score -- --all          # no cap
   ```

Scores appear in Discover's **Fit** column (reason on hover). If you keep résumés
at `.private/resume-infra.tex` and `.private/resume-mlinfra.tex` plus
`.private/preferences.md`, the scorer also recommends which résumé version fits
each job better. The `.private/` folder is gitignored and never committed.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app (http://localhost:3000) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run ingest` | Fetch + tag + upsert jobs (`-- --include-inactive` to keep closed roles) |
| `npm run score` | Optional AI fit scoring (`-- --limit N` / `-- --all`) |
| `npm test` | Run the Vitest suite |
| `npm run check:location` | Cross-check location tagging vs the reference Python |
| `npm run db:migrate` / `db:studio` | Prisma migrate / open Prisma Studio |

## Data sources

- [SimplifyJobs/New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions)
- [SimplifyJobs/Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships)

Both are community-maintained, update several times daily, and need no API key.
Adding a new source is a drop-in behind the ingest seam (`src/ingest/sources/`).

## Project layout

```
prisma/schema.prisma        Job + Application models (SQLite)
scripts/                    ingest.ts, score.ts, check_location.ts
src/app/                    pages (tracker, discover, dashboard) + API routes
src/components/             UI (tracker table + kanban, discover table, charts)
src/lib/                    location, scope, scoring, dashboard, scorer, db
src/ingest/                 pluggable fetch → tag → upsert pipeline
tests/                      Vitest suites for the pure logic
```

## Notes

- Single user, local-first; cleanly deployable to Vercel later (would move SQLite
  to a hosted Postgres).
- Re-run `npm run ingest` anytime to refresh the feed; it dedupes on URL and
  preserves your applications and fit scores.
