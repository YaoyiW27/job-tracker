// Score one ad-hoc job description against every resume variant, without
// touching the database. For a posting you found yourself rather than one the
// ingest pulled in.
//
//   pbpaste | npm run score:jd -- --company Clio --title "Systems Engineer"
//   npm run score:jd -- --file jd.txt --company Clio --title "Systems Engineer"
//
// Paste the description text, not a URL — LinkedIn and most boards block
// fetching, so the text is the reliable input.
try {
  process.loadEnvFile();
} catch {
  /* no .env file — fine; falls back to shell env / no-key mode */
}

import { readFileSync } from "node:fs";

import {
  countWords,
  isScoringEnabled,
  loadScoreContext,
  looksLikeFullDescription,
  scoreJob,
  type JobMeta,
} from "../src/lib/scorer";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readDescription(): string {
  const file = arg("file");
  if (file) return readFileSync(file, "utf-8");
  return readFileSync(0, "utf-8"); // stdin
}

async function main() {
  if (!isScoringEnabled()) {
    console.error("[score:jd] ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const description = readDescription().trim();
  if (!description) {
    console.error("[score:jd] No description on stdin or --file.");
    process.exit(1);
  }

  // Refuse a truncated paste rather than scoring it. A partial copy still
  // produces a confident-looking number, and a low score from a short input
  // reads as "bad job" when it means "bad input".
  const words = countWords(description);
  if (!looksLikeFullDescription(description) && !process.argv.includes("--force")) {
    console.error(
      `[score:jd] Only ${words} words of description — that is almost certainly a partial copy.\n` +
        `           Expand "Show more" on the posting and copy the whole thing, or pass --force to score it anyway.`,
    );
    process.exit(1);
  }
  console.log(`[score:jd] ${words} words of description`);

  const ctx = loadScoreContext();
  const job: JobMeta = {
    company: arg("company") ?? "unknown",
    title: arg("title") ?? "unknown",
    locations: arg("location") ? [arg("location")!] : [],
    terms: [],
    locationFit: arg("location-fit") ?? "unknown",
    salary: arg("salary") ?? null,
    description,
  };

  console.log(
    `[score:jd] model=${ctx.model} · ${ctx.variants.length} resume variants: ${ctx.variants
      .map((v) => v.id)
      .join(", ")}\n`,
  );

  const result = await scoreJob(job, ctx);
  if (!result) {
    console.error("[score:jd] No usable response (refusal or parse failure).");
    process.exit(1);
  }

  console.log(`  fit score   ${result.fitScore}/100`);
  console.log(`  why         ${result.fitReason}`);
  console.log(`  best resume ${result.betterResume}`);
  if (result.resumeReason) console.log(`  because     ${result.resumeReason}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
