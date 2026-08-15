import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildScoreMessages,
  buildScoreSchema,
  normalizeScoreResult,
  type JobMeta,
  type ResumeVariant,
  type ScoreResult,
} from "./prompt";
import { discoverResumeVariants, preferencesFromEnv, variantsFromEnv } from "./variants";

export {
  isScoringEnabled,
  formatFitReason,
  looksLikeFullDescription,
  countWords,
  MIN_DESCRIPTION_WORDS,
} from "./prompt";
export type { JobMeta, ResumeVariant, ScoreResult } from "./prompt";
export { discoverResumeVariants, preferencesFromEnv, variantsFromEnv } from "./variants";

const DEFAULT_MODEL = "claude-opus-5";

export interface ScoreContext {
  preferences: string;
  variants: ResumeVariant[];
  model: string;
}

/** Minimal client surface scoreJob needs — lets tests inject a stub. */
export interface ScoreClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

/**
 * Load the scorer's context from .private/ (never committed). Resumes are LaTeX
 * → plain text. Model is overridable via ANTHROPIC_MODEL for cost control.
 */
export class ScoreContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreContextError";
  }
}

export function loadScoreContext(
  privateDir = join(process.cwd(), ".private"),
  env: NodeJS.ProcessEnv = process.env,
): ScoreContext {
  const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;

  // 1. Local: read .private/ off disk.
  try {
    const preferences = readFileSync(join(privateDir, "preferences.md"), "utf-8");
    const variants = discoverResumeVariants(privateDir);
    if (variants.length > 0) return { preferences, variants, model };
  } catch {
    // No .private/ here — fall through to the env-var source below.
  }

  // 2. Deployed: .private/ is gitignored and never shipped, so a deployment
  // supplies the same content as base64 env vars.
  const preferences = preferencesFromEnv(env);
  const variants = variantsFromEnv(env);
  if (preferences && variants.length > 0) return { preferences, variants, model };

  throw new ScoreContextError(
    "Scorer context unavailable: no .private/ on disk and no SCORER_PREFERENCES_B64 / " +
      "SCORER_RESUME_<ID>_B64 env vars. See the README (AI fit scorer).",
  );
}

/**
 * Score one job against my preferences + both resumes via Claude. Returns null
 * on refusal or an unparseable response so the caller can skip that job. Assumes
 * an API key is configured (guard with isScoringEnabled first).
 */
export async function scoreJob(
  job: JobMeta,
  ctx: ScoreContext,
  client: ScoreClient = new Anthropic(), // resolves ANTHROPIC_API_KEY / profile from env
): Promise<ScoreResult | null> {
  const { system, user } = buildScoreMessages(job, ctx.preferences, ctx.variants);
  const ids = ctx.variants.map((v) => v.id);
  const schema = buildScoreSchema(ids);

  // No `effort` — it's optional and rejected by models like Haiku 4.5.
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: ctx.model,
    max_tokens: 1024,
    system,
    output_config: {
      format: { type: "json_schema", schema: schema as unknown as Record<string, unknown> },
    },
    messages: [{ role: "user", content: user }],
  };

  let res: Anthropic.Message;
  try {
    res = await client.messages.create(params);
  } catch {
    // API error (unsupported param, rate limit, transient failure) — skip this
    // one job so the batch keeps going instead of failing across the board.
    return null;
  }

  if (res.stop_reason === "refusal") return null;

  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!text) return null;
  try {
    return normalizeScoreResult(JSON.parse(text.text), ids);
  } catch {
    return null;
  }
}
