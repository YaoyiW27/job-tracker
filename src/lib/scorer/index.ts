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
export async function scoreJob(job: JobMeta, ctx: ScoreContext): Promise<ScoreResult | null> {
  const client = new Anthropic(); // resolves ANTHROPIC_API_KEY / profile from env
  const { system, user } = buildScoreMessages(job, ctx.preferences, ctx.resumeA, ctx.resumeB);

  // output_config (structured outputs) may lag the installed SDK's static types.
  const params = {
    model: ctx.model,
    max_tokens: 1024,
    system,
    output_config: { format: { type: "json_schema", schema: SCORE_SCHEMA }, effort: "low" },
    messages: [{ role: "user", content: user }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming;

  const res = await client.messages.create(params);
  if (res.stop_reason === "refusal") return null;

  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!text) return null;
  try {
    return normalizeScoreResult(JSON.parse(text.text));
  } catch {
    return null;
  }
}
