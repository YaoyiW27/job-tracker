# Job Tracker

A personal web app for a new-grad / early-career software job search. It runs
locally and deploys to a fixed URL; both read one hosted Postgres, so anything
ingested or scored from a laptop shows up on the site immediately. It does two
things:

- **Track (the core)** — a Notion-style, inline-editable table + Kanban board + a
  dashboard for everything you're applying to and where each application stands.
  Works fully on its own; **manually adding a row is the primary way in** (paste a
  job URL and it pre-fills company + title).
- **Discover (one feed into the tracker)** — pulls new-grad/intern postings from
  public datasets, tags each by location fit + work-authorization flags, ranks
  them, and lets you save any row to the tracker in one click. An optional
  AI **fit scorer** rates jobs 0–100 against your preferences.

It is **not** an auto-apply or form-autofill tool.

## Daily use

Nothing to run. GitHub Actions ingests and scores every morning, so the site is
already up to date when you open it. Three things to actually do:

1. **Open the site, enter the password.** On **Discover**, work down the ranked
   list and hit **Save** on anything worth applying to — it lands in the tracker.
2. **Add jobs found elsewhere** (LinkedIn, a company's careers page) on
   **Tracker** → **+ Add row**: paste the URL, click **Prefill**, and company +
   title fill themselves in. Edit anything, then save.
3. **Keep statuses current** as you hear back — inline in the table, or by
   dragging cards in **Board** view. The **Dashboard** charts fill in on their
   own once there are a few applications; they are empty until then.

## Stack

Next.js (App Router) + TypeScript · Tailwind CSS v4 · PostgreSQL via Prisma
(hosted on [Neon](https://neon.tech)) · TanStack Table · Recharts · Vitest.
Deployed on Vercel; refreshed nightly by GitHub Actions. One runtime, one
`npm run dev`. No account system — the deployment is gated by a single password.

## Requirements

- Node.js ≥ 20 (developed on 24)
- npm

## Quick start

```bash
git clone <your-repo-url> job-tracker
cd job-tracker
npm install

# 1. set DATABASE_URL + DIRECT_URL in .env to a Postgres db (see Deploy section
#    for a free Neon setup), then create the tables:
npm run db:push

# 2. pull jobs into the Discover feed (optional, but populates Discover)
npm run ingest

# 3. run the app
npm run dev
```

Open **http://localhost:3000** — it lands on the Tracker. Use the top nav to
switch between **Tracker**, **Discover**, and **Dashboard**.

The app runs fine with an empty tracker; `npm run ingest` (and scoring) are
optional.

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
| `npm run db:push` | Sync the schema to the database (creates the tables) |
| `npm run db:migrate` / `db:studio` | Prisma migrate / open Prisma Studio |

## How ingest works

There is no scraper. Both sources publish a `listings.json` that the ingest
downloads directly, so there is no HTML parsing, no API key, no rate limit, and
nothing to get blocked:

- [SimplifyJobs/New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions) → tagged `NEW_GRAD`
- [SimplifyJobs/Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships) → tagged `INTERN`

Both are community-maintained and update several times daily. The pipeline
(`src/ingest/`) is four steps:

1. **Fetch** (`sources/simplify.ts`) — one GET per source. A source that fails is
   logged and skipped; the others still run.
2. **Extract** (`normalize.ts`) — the datasets rename fields occasionally, so
   every field is read from a list of candidate keys (company from
   `company_name` then `company`; salary from `salary` / `salary_range` /
   `compensation` / `pay`). A record with no company or title is dropped.
3. **Tag** — three pure, unit-tested functions: `classifyLocation` (the seven
   buckets), `evaluateScope` (in-scope + work-auth flags), and
   `effectiveLocationRank` (bucket rank plus a top-tier-company bump). Nothing is
   filtered out here; poor fits are kept, flagged, and demoted.
4. **Upsert** (`index.ts`) — keyed on `Job.url`, so re-running never duplicates.
   Records with no apply link get a synthesized `urn:<source>:<id>` key.

Two behaviors worth knowing:

- **Fit scores survive re-ingest.** `fitScore` / `fitReason` are deliberately left
  out of the upsert payload, so the nightly run never wipes scoring you paid for.
- **Closed roles are skipped by default.** Most of each feed is inactive or
  hidden postings — that's why a run scans ~33k records and keeps ~4.7k. Use
  `npm run ingest -- --include-inactive` to keep them.

Adding a source means implementing the `Source` interface in
`src/ingest/sources/types.ts` (one `fetch()` returning raw records) and adding a
line to `registry.ts`. The orchestrator needs no changes.

The one place that does read a web page is **Prefill**
(`src/app/api/prefill/route.ts`): when you paste a job URL into **+ Add row** it
fetches that single page and pulls company + title from JSON-LD / OpenGraph /
`<title>`. Manual, one page at a time, entirely separate from ingest.

## Project layout

```
prisma/schema.prisma        Job + Application models (PostgreSQL)
.github/workflows/daily.yml nightly ingest + incremental scoring
scripts/                    ingest.ts, score.ts, check_location.ts
src/app/                    pages (tracker, discover, dashboard) + API routes
src/components/             UI (tracker table + kanban, discover table, charts)
src/lib/                    location, scope, scoring, dashboard, scorer, db
src/ingest/                 pluggable fetch → tag → upsert pipeline
tests/                      Vitest suites for the pure logic
```

## Deployment

Live at **https://yaoyi-job-tracker.vercel.app** — password-gated, so a browser
prompt appears before anything loads. Vercel redeploys on every push to `main`.

### Setting it up from scratch (Vercel + Neon)

Local scripts and the deployment share one Neon database.

1. **Create a free Postgres** at [neon.tech](https://neon.tech). Copy both
   connection strings: the **pooled** URL (host contains `-pooler`) → `DATABASE_URL`,
   and the **direct** URL → `DIRECT_URL`.
2. **Set up the schema + data** locally against Neon:
   ```bash
   # put both URLs in .env, then:
   npm run db:push      # create tables on Neon
   npm run ingest       # load jobs
   npm run score        # optional
   ```
3. **Import the repo on [vercel.com](https://vercel.com)** and add Environment
   Variables: `DATABASE_URL`, `DIRECT_URL`, `APP_PASSWORD` (a password to gate the
   site), and optionally `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`. Deploy.
4. Open the Vercel URL — the browser prompts for the password (any username +
   your `APP_PASSWORD`).

Access is protected by HTTP Basic auth (`src/middleware.ts`) whenever
`APP_PASSWORD` is set; unset locally, the app stays open. Pages *and* API routes
are gated — only static assets and the app icons are served unauthenticated, so
browsers can still fetch the favicon.

## Automation (GitHub Actions)

`.github/workflows/daily.yml` keeps the database fresh without the laptop being
on. It runs at **14:00 UTC daily** (07:00 Vancouver) and writes straight to Neon —
no redeploy needed, since the site reads the same database.

| Job | What it does |
|---|---|
| `ingest` | Pulls the public feeds and upserts them. Always runs. |
| `score` | Fit-scores only jobs with `fitScore = null` (incremental by design), capped at 40 per run so a backlog doesn't arrive as one large bill. |

Manual run — useful after changing scoring criteria, or to work through a backlog:

```bash
gh workflow run daily.yml -f score_limit=40     # ingest + score
gh workflow run daily.yml -f run_score=false    # ingest only
```

### Required repository secrets

Set once with `gh secret set <NAME> --repo <owner>/<repo>`, reading from a file
so values never land in shell history:

| Secret | Value |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | The same two Neon strings as `.env` |
| `ANTHROPIC_API_KEY` | Only needed for the `score` job |
| `PRIVATE_PREFERENCES_B64` | `base64 -i .private/preferences.md \| tr -d '\n'` |
| `PRIVATE_RESUME_INFRA_B64` | `base64 -i .private/resume-infra.tex \| tr -d '\n'` |
| `PRIVATE_RESUME_MLINFRA_B64` | `base64 -i .private/resume-mlinfra.tex \| tr -d '\n'` |

The scorer reads `.private/`, which is gitignored and never committed — so the
workflow reconstructs those three files from secrets for the length of the run
and prints only their byte sizes. Optional repo *variable* `ANTHROPIC_MODEL`
overrides the model (defaults to `claude-sonnet-5` in CI).

Re-run these `base64` commands and re-set the secret whenever a résumé changes;
CI has no other way to see the edit.

**GitHub disables scheduled workflows after 60 days with no repository
activity.** Normal use (any commit) resets the clock; if it does trip, the
Actions tab shows a banner with a button to re-enable it.

## Notes

- Single user; the site is gated by `APP_PASSWORD`, not a full account system.
- Re-run `npm run ingest` anytime to refresh the feed; it dedupes on URL and
  preserves your applications and fit scores. Local runs and the nightly Actions
  run write to the same database the site reads, so either one is enough.
- `npm run score` re-scores nothing: it only looks at jobs whose `fitScore` is
  still null. To re-score after changing the criteria, clear those scores first.
