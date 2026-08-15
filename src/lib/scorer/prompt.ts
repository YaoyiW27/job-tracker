// Pure prompt-building, result-normalization, and no-key gating for the fit
// scorer. The Claude call itself lives in index.ts; everything here is testable
// without a network or API key.

export interface JobMeta {
  /** Optional: when absent and a description is given, the model reads it from the text. */
  company?: string;
  title?: string;
  locations: string[];
  terms: string[];
  locationFit: string;
  salary: string | null;
  /** Full posting text when we have it. Absent for ingested jobs (metadata only). */
  description?: string;
}

/** One resume on disk: `AIops`, "infra / platform / DevOps / SRE", plain text. */
export interface ResumeVariant {
  id: string;
  label: string;
  text: string;
}

export interface ScoreResult {
  fitScore: number; // 0..100
  fitReason: string; // one line
  betterResume: string; // a variant id, or "either"
  resumeReason: string;
  /** Echoed back so a wrong read — or a paste that lost the company — is visible. */
  company: string;
  title: string;
}

/**
 * JSON schema for structured outputs, built per-run so `betterResume` is
 * constrained to the variants that actually exist on disk.
 */
export function buildScoreSchema(variantIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      company: {
        type: "string",
        description: "the hiring company — from the metadata if given, else read from the description; 'unknown' if absent",
      },
      title: {
        type: "string",
        description: "the role title — from the metadata if given, else read from the description; 'unknown' if absent",
      },
      fitScore: { type: "integer", description: "0-100 overall fit for me" },
      fitReason: {
        type: "string",
        description: "one line citing the single strongest signal (positive or negative)",
      },
      betterResume: { type: "string", enum: [...variantIds, "either"] },
      resumeReason: {
        type: "string",
        description:
          "why that resume fits better, grounded in the resume; 'no evidence' if not backed",
      },
    },
    required: ["company", "title", "fitScore", "fitReason", "betterResume", "resumeReason"],
  } as const;
}

function buildSystem(variants: ResumeVariant[], hasDescription: boolean): string {
  const roster = variants.map((v) => `- ${v.id} — ${v.label}`).join("\n");
  const evidence = hasDescription
    ? "You are given the full job description. Judge on what it actually says."
    : "You are given job METADATA only (title, company, location, terms) — no description. Infer conservatively; when a signal is absent, treat it as neutral, not positive.";

  return `You score how well a job fits ME on a 0-100 scale, and pick which of my resumes fits it best.

Scoring (0-100), weighting in this order:
1. AI-acceptance (highest) — does the company actively use/encourage AI-assisted development (Claude Code, Copilot, AI agents, internal AI tooling)?
2. Salary potential (highest).
3. Engineering culture — build-focused (not ticket/maintenance), modern cloud-native tooling, high technical growth.
4. Location fit.
Reward AI-forward, build-heavy, modern-stack signals. Penalize support/ticket/maintenance, heavy bureaucracy, approval-heavy orgs. Do NOT auto-favor large traditional enterprises unless they clearly show strong eng/AI culture.

${evidence}

Resume choice: my resumes share one experience section and differ in project emphasis:
${roster}
Answer with one of those ids, or "either" when nothing distinguishes them, and say why in one line grounded in the resume text you were given. NEVER invent or suggest a skill/keyword that is not backed by something in the resumes — if there is no evidence, say "no evidence".

Also report the company and role you scored: use the metadata when it is given, otherwise read them out of the description, and say "unknown" if neither states them.

fitReason must be a single line citing the strongest signal. Return only the structured fields.`;
}

export function buildScoreMessages(
  job: JobMeta,
  preferences: string,
  variants: ResumeVariant[],
): { system: string; user: string } {
  const hasDescription = Boolean(job.description?.trim());

  // With a description in hand, omit the metadata fields we have no value for
  // rather than printing "not listed" / "—". Those placeholders are honest for
  // the ingest path, where metadata is all there is, but here they would assert
  // an absence that the description itself very likely contradicts — and salary
  // and location are two of the four scoring weights.
  const line = (label: string, value: string, placeholder: string) =>
    value ? `${label}: ${value}` : hasDescription ? null : `${label}: ${placeholder}`;

  const head = [
    hasDescription ? "# Job" : "# Job (metadata only)",
    line("Company", job.company ?? "", "unknown"),
    line("Title", job.title ?? "", "unknown"),
    line("Locations", job.locations.join(" | "), "—"),
    line("Location bucket", job.locationFit === "unknown" ? "" : job.locationFit, job.locationFit),
    line("Terms", job.terms.join(", "), "—"),
    line("Salary", job.salary ?? "", "not listed"),
  ].filter((l): l is string => l !== null);

  if (hasDescription) {
    head.push(
      "",
      "Any field above that is missing is simply not filled in here — read it from the description.",
      "",
      "## Description",
      job.description!.trim(),
    );
  }

  const resumes = variants.flatMap((v) => ["", `# Resume ${v.id} (${v.label})`, v.text.trim()]);

  return {
    system: buildSystem(variants, hasDescription),
    user: [...head, "", "# My preferences", preferences.trim(), ...resumes].join("\n"),
  };
}

export function normalizeScoreResult(raw: unknown, validIds: string[]): ScoreResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const n = Math.round(Number(r.fitScore));
  const fitScore = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  const chosen = String(r.betterResume ?? "");
  // A schema enum constrains the model, but normalize independently so a
  // hallucinated or renamed variant degrades to "either" instead of being
  // stored as a resume that does not exist.
  const betterResume = validIds.includes(chosen) ? chosen : "either";
  return {
    company: String(r.company ?? "").trim() || "unknown",
    title: String(r.title ?? "").trim() || "unknown",
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

/**
 * Whether a pasted description is long enough to actually score against.
 *
 * A partial copy (one bullet, a truncated selection, a page that still needed
 * "Show more" clicked) is the common failure: the model dutifully returns a
 * confident number computed from almost nothing, and the low score reads as
 * "bad job" rather than "bad input". Cheap to catch, expensive to miss.
 */
export function looksLikeFullDescription(text: string, minWords = 50): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length >= minWords;
}

/** Scoring is optional — enabled only when an Anthropic API key is configured. */
export function isScoringEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim());
}
