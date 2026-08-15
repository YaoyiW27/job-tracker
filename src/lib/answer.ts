// Draft an answer to an application-form short-answer question.
//
// The recurring ones ("Why are you interested in working for X?") have a stable
// shape: only the company-specific sentence really changes between similar
// roles. So the skeleton is fixed in the prompt and the substance is pulled from
// two places that can be checked — the posting, and my own résumé.
//
// Writing, not extraction, so this runs on a stronger model than prefill;
// override with ANSWER_MODEL.

import Anthropic from "@anthropic-ai/sdk";
import type { ResumeVariant } from "./scorer/prompt";

const DEFAULT_MODEL = "claude-sonnet-5";

/** Long enough for any posting; bounds the cost of one bad paste. */
export const MAX_DESCRIPTION_CHARS = 20_000;

export interface AnswerContext {
  preferences: string;
  /** Voice + structure rules from .private/answer-style.md, if present. */
  style: string;
  /** The résumé this application will actually send. */
  variant: ResumeVariant;
}

export interface AnswerRequest {
  question: string;
  description: string;
  company?: string;
  /** Anything I know that isn't in the posting — a referral, something a friend said. */
  notes?: string;
}

export interface AnswerResult {
  answer: string;
  /** Facts taken from the posting, so a fabricated one is visible at a glance. */
  fromPosting: string[];
  /** Evidence taken from the résumé. */
  fromResume: string[];
  /** What the question asks for that the material can't support. */
  gaps: string[];
  wordCount: number;
}

export interface AnswerClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string", description: "the answer to paste into the form" },
    fromPosting: {
      type: "array",
      items: { type: "string" },
      description: "each fact about the company/role this answer used, quoted or closely paraphrased from the posting",
    },
    fromResume: {
      type: "array",
      items: { type: "string" },
      description: "each piece of my own experience this answer used, from the résumé",
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description: "anything the question asks about that neither the posting nor the résumé supports",
    },
  },
  required: ["answer", "fromPosting", "fromResume", "gaps"],
} as const;

const SYSTEM_HEAD = `You draft one short answer to a job-application form question, in my voice, for me to review and paste.

## Hard rules

- Every claim about the company or the role must come from the posting below. If the posting does not say it, it does not go in the answer.
- Every claim about my experience must come from my résumé below. Do not invent a project, a tool, or a number. Do not stretch "used X once" into "expert in X".
- Never invent enthusiasm. No "I have always admired", no "world-class", no "excited to". Referencing what they build is fine; praising them is not.
- If the question asks about something neither source supports, leave it out of the answer and list it under gaps. A shorter honest answer beats a padded one.

## Culture and values

Postings usually contain a values or "about the team" paragraph. Use it — but never by echoing it back. "I admire your no-egos culture" is worth nothing and every applicant writes it.

Pair a stated value with evidence that I have actually done that thing, from my résumé. If nothing in my résumé evidences the value they state, say nothing about culture at all and use the sentence on the work instead.

## Length

3–4 sentences, 60–100 words. This is a form field, not a cover letter.`;

export function countWords(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

/** The question these forms ask when the user didn't paste the exact wording. */
export function defaultQuestion(question: string, company: string): string {
  const q = question.trim();
  if (q) return q;
  const who = company.trim();
  return who
    ? `Why are you interested in working for ${who}?`
    : "Why are you interested in this role at this company?";
}

export function buildAnswerMessages(
  req: AnswerRequest,
  ctx: AnswerContext,
): { system: string; user: string } {
  const system = [
    SYSTEM_HEAD,
    "## My voice",
    ctx.style.trim() || "Short, plain, first person. No enthusiasm words.",
    "## What I look for in a role (context, not something to quote)",
    ctx.preferences.trim(),
    `## My résumé for this application (${ctx.variant.label})`,
    ctx.variant.text,
  ].join("\n\n");

  const user = [
    `# Question on the form\n\n${defaultQuestion(req.question, req.company ?? "")}`,
    `# The posting\n\n${req.description.trim().slice(0, MAX_DESCRIPTION_CHARS)}`,
    req.notes?.trim()
      ? `# What I know that isn't in the posting\n\n${req.notes.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

function list(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export function normalizeAnswer(raw: unknown): AnswerResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const answer = typeof r.answer === "string" ? r.answer.trim() : "";
  return {
    answer,
    fromPosting: list(r.fromPosting),
    fromResume: list(r.fromResume),
    gaps: list(r.gaps),
    wordCount: countWords(answer),
  };
}

/**
 * Draft the answer. Returns null on refusal, an API error, or an unparseable
 * reply, so the page can say "couldn't draft that" instead of showing a stack
 * trace. The caller decides whether a key is configured.
 */
export async function draftAnswer(
  req: AnswerRequest,
  ctx: AnswerContext,
  client: AnswerClient = new Anthropic(),
): Promise<AnswerResult | null> {
  const { system, user } = buildAnswerMessages(req, ctx);

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: process.env.ANSWER_MODEL?.trim() || DEFAULT_MODEL,
    // Generous: the model emits a thinking block before the JSON, and a budget
    // that only fits the answer truncates the JSON into a parse failure.
    max_tokens: 4096,
    system,
    output_config: {
      format: { type: "json_schema", schema: ANSWER_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [{ role: "user", content: user }],
  };

  let res: Anthropic.Message;
  try {
    res = await client.messages.create(params);
  } catch {
    return null;
  }
  if (res.stop_reason === "refusal") return null;

  const block = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) return null;
  try {
    return normalizeAnswer(JSON.parse(block.text));
  } catch {
    return null;
  }
}
