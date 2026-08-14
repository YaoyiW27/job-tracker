// Pure prompt-building, result-normalization, and no-key gating for the fit
// scorer. The Claude call itself lives in index.ts; everything here is testable
// without a network or API key.

export interface JobMeta {
  company: string;
  title: string;
  locations: string[];
  terms: string[];
  locationFit: string;
  salary: string | null;
}

export interface ScoreResult {
  fitScore: number; // 0..100
  fitReason: string; // one line
  betterResume: "A" | "B" | "either";
  resumeReason: string;
}

// JSON-schema for structured outputs (output_config.format).
export const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    fitScore: { type: "integer", description: "0-100 overall fit for me" },
    fitReason: { type: "string", description: "one line citing the single strongest signal (positive or negative)" },
    betterResume: { type: "string", enum: ["A", "B", "either"] },
    resumeReason: { type: "string", description: "why that resume fits better, grounded in the resume; 'no evidence' if not backed" },
  },
  required: ["fitScore", "fitReason", "betterResume", "resumeReason"],
} as const;

const SYSTEM = `You score how well a job fits ME, a CS new-grad, on a 0-100 scale, and pick which of my two resumes fits better.

Scoring (0-100), weighting in this order:
1. AI-acceptance (highest) — does the company actively use/encourage AI-assisted development (Claude Code, Copilot, AI agents, internal AI tooling)?
2. Salary potential (highest).
3. Engineering culture — build-focused (not ticket/maintenance), modern cloud-native tooling, high technical growth.
4. Location fit.
Reward AI-forward, build-heavy, modern-stack signals. Penalize support/ticket/maintenance, heavy bureaucracy, approval-heavy orgs. Do NOT auto-favor large traditional enterprises unless they clearly show strong eng/AI culture.

You are given only job METADATA (title, company, location, terms) — no full description. Infer conservatively; when a signal is absent, treat it as neutral, not positive.

Resume choice: I have two resumes with the same experience, different emphasis:
- Resume A — infra / platform / DevOps / SRE (also the default for general SDE roles).
- Resume B — ML infra / ML systems / AI platform (leads with LLM serving stack + CUDA).
Pick "A", "B", or "either", and say why in one line, grounded in the resume text you were given. NEVER invent or suggest a skill/keyword that is not backed by something in the resumes — if there is no evidence, say "no evidence".

fitReason must be a single line citing the strongest signal. Return only the structured fields.`;

export function buildScoreMessages(
  job: JobMeta,
  preferences: string,
  resumeA: string,
  resumeB: string,
): { system: string; user: string } {
  const user = [
    "# Job (metadata only)",
    `Company: ${job.company}`,
    `Title: ${job.title}`,
    `Locations: ${job.locations.join(" | ") || "—"}`,
    `Location bucket: ${job.locationFit}`,
    `Terms: ${job.terms.join(", ") || "—"}`,
    `Salary: ${job.salary ?? "not listed"}`,
    "",
    "# My preferences",
    preferences.trim(),
    "",
    "# Resume A (infra / platform / DevOps / SRE)",
    resumeA.trim(),
    "",
    "# Resume B (ML infra / ML systems / AI platform)",
    resumeB.trim(),
  ].join("\n");

  return { system: SYSTEM, user };
}

export function normalizeScoreResult(raw: unknown): ScoreResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const n = Math.round(Number(r.fitScore));
  const fitScore = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  const br = r.betterResume;
  const betterResume = br === "A" || br === "B" ? br : "either";
  return {
    fitScore,
    fitReason: String(r.fitReason ?? "").trim() || "No reason provided",
    betterResume,
    resumeReason: String(r.resumeReason ?? "").trim(),
  };
}

/** Compact one-line reason for storage on Job.fitReason. */
export function formatFitReason(r: ScoreResult): string {
  if (r.betterResume === "either") return r.fitReason;
  const clause = r.resumeReason ? `: ${r.resumeReason}` : "";
  return `${r.fitReason} · Resume ${r.betterResume}${clause}`;
}

/** Scoring is optional — enabled only when an Anthropic API key is configured. */
export function isScoringEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim());
}
