// Optional LLM fit scorer. Scores unscored, in-scope jobs against my
// preferences + both resumes and writes fitScore/fitReason back to SQLite.
//
//   npm run score                 # score up to --limit (default 25) unscored jobs
//   npm run score -- --limit 100
//   npm run score -- --all        # no cap
//
// No ANTHROPIC_API_KEY? It skips cleanly (fixture/no-key mode) — the app still runs.
import { db } from "../src/lib/db";
import {
  isScoringEnabled,
  loadScoreContext,
  scoreJob,
  formatFitReason,
  type JobMeta,
} from "../src/lib/scorer";

function parseArgs() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const li = args.indexOf("--limit");
  const limit = li >= 0 ? Number(args[li + 1]) : 25;
  return { all, limit: Number.isFinite(limit) ? limit : 25 };
}

function toStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}

async function main() {
  if (!isScoringEnabled()) {
    console.log(
      "[score] No ANTHROPIC_API_KEY set — skipping fit scoring (no-key mode). The app still runs; Discover just shows no fitScore.",
    );
    return;
  }

  const { all, limit } = parseArgs();
  const ctx = loadScoreContext();
  console.log(`[score] model=${ctx.model} · scoring in-scope, unscored jobs${all ? "" : ` (limit ${limit})`}`);

  const jobs = await db.job.findMany({
    where: { fitScore: null, inScope: true },
    orderBy: [{ locationRank: "asc" }, { datePosted: "desc" }],
    ...(all ? {} : { take: limit }),
  });

  console.log(`[score] ${jobs.length} to score`);
  let scored = 0;
  let skipped = 0;

  for (const job of jobs) {
    const meta: JobMeta = {
      company: job.company,
      title: job.title,
      locations: toStringArray(job.locations),
      terms: toStringArray(job.terms),
      locationFit: job.locationFit,
      salary: job.salary,
    };
    try {
      const result = await scoreJob(meta, ctx);
      if (!result) {
        skipped++;
        continue;
      }
      await db.job.update({
        where: { id: job.id },
        data: { fitScore: result.fitScore, fitReason: formatFitReason(result) },
      });
      scored++;
      console.log(`  ${String(result.fitScore).padStart(3)}  ${job.company} — ${job.title.slice(0, 48)}`);
    } catch (err) {
      skipped++;
      console.error(`  [!] ${job.company} — ${job.title.slice(0, 40)}: ${(err as Error).message}`);
    }
  }

  console.log(`[score] done — ${scored} scored, ${skipped} skipped`);
}

main()
  .then(() => db.$disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
