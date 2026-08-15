import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { stripLatex } from "./latex";
import {
  buildScoreMessages,
  normalizeScoreResult,
  SCORE_SCHEMA,
  type JobMeta,
  type ScoreResult,
} from "./prompt";

export { isScoringEnabled, formatFitReason } from "./prompt";
export type { JobMeta, ScoreResult } from "./prompt";

const DEFAULT_MODEL = "claude-opus-5";

export interface ScoreContext {
  preferences: string;
  resumeA: string;
  resumeB: string;
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
export function loadScoreContext(privateDir = join(process.cwd(), ".private")): ScoreContext {
  const preferences = readFileSync(join(privateDir, "preferences.md"), "utf-8");
  const resumeA = stripLatex(readFileSync(join(privateDir, "resume-infra.tex"), "utf-8"));
  const resumeB = stripLatex(readFileSync(join(privateDir, "resume-mlinfra.tex"), "utf-8"));
  return {
    preferences,
    resumeA,
    resumeB,
    model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
  };
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
  const { system, user } = buildScoreMessages(job, ctx.preferences, ctx.resumeA, ctx.resumeB);

  // No `effort` — it's optional and rejected by models like Haiku 4.5.
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: ctx.model,
    max_tokens: 1024,
    system,
    output_config: {
      format: { type: "json_schema", schema: SCORE_SCHEMA as unknown as Record<string, unknown> },
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
    return normalizeScoreResult(JSON.parse(text.text));
  } catch {
    return null;
  }
}
