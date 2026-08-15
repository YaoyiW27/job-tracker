// Prefill from a *pasted* posting instead of a URL.
//
// IBM, LinkedIn and Workday answer a server-side fetch with a bot-check page
// (see parseMetadata in ./prefill.ts), so the URL path can never work for them.
// You already have the text on screen — paste it and pull the same three fields
// out of it with a small model call.
//
// Deliberately a different model from the fit scorer: this is field extraction,
// not judgement, so it runs on Haiku and is overridable via PREFILL_MODEL.

import Anthropic from "@anthropic-ai/sdk";

/** Enough for any real posting; caps what one bad paste can cost. */
export const MAX_PASTE_CHARS = 20_000;

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export interface ExtractResult {
  company: string | null;
  title: string | null;
  salary: string | null;
  location: string | null;
}

/** Minimal client surface — lets tests inject a stub, as the scorer does. */
export interface ExtractClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    company: { type: ["string", "null"], description: "hiring company, or null if not stated" },
    title: { type: ["string", "null"], description: "job title, or null if not stated" },
    salary: {
      type: ["string", "null"],
      description: "compensation exactly as written, e.g. '$120,000 - $150,000 CAD'; null if absent",
    },
    location: {
      type: ["string", "null"],
      description: "where the job is, e.g. 'Vancouver, BC, Canada' or 'Remote (Canada)'; null if absent",
    },
  },
  required: ["company", "title", "salary", "location"],
} as const;

const SYSTEM = `You extract four fields from a pasted job posting: the hiring company, the job title, the compensation, and the location.

Rules:
- Copy what the posting says. Do not paraphrase a title or expand a company name.
- Return null for anything the posting does not state. Never guess: no inferring salary from the company's size or the seniority of the role, and no inferring the company from the job board it was posted on.
- Salary: reproduce the range as written, including currency and period. Null if the posting gives no figures.
- Location: as the posting states it. Say "Remote" (with the region in brackets when given, e.g. "Remote (Canada)") for remote roles. Null if the posting does not say.
- The paste often includes site navigation and boilerplate. Ignore it.`;

export function isExtractionEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function clampPaste(text: string): string {
  return text.trim().slice(0, MAX_PASTE_CHARS);
}

export function buildExtractMessages(text: string): { system: string; user: string } {
  return {
    system: SYSTEM,
    user: `# Pasted job posting\n\n${clampPaste(text)}`,
  };
}

// A model can satisfy a ["string","null"] schema and still write the *word*
// "null" or "N/A", which would land in the company column verbatim.
const NON_ANSWERS = new Set(["null", "none", "n/a", "na", "unknown", "not specified", "not stated"]);

function field(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || NON_ANSWERS.has(s.toLowerCase())) return null;
  return s;
}

export function normalizeExtract(raw: unknown): ExtractResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    company: field(r.company),
    title: field(r.title),
    salary: field(r.salary),
    location: field(r.location),
  };
}

/**
 * Pull company/title/salary out of a pasted posting. Returns null on refusal,
 * an API error, or an unparseable reply, so the caller can fall back to manual
 * entry instead of surfacing a stack trace. Assumes a key is configured — guard
 * with isExtractionEnabled first.
 */
export async function extractFromText(
  text: string,
  client: ExtractClient = new Anthropic(),
): Promise<ExtractResult | null> {
  const { system, user } = buildExtractMessages(text);

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: process.env.PREFILL_MODEL?.trim() || DEFAULT_MODEL,
    max_tokens: 512,
    system,
    output_config: {
      format: { type: "json_schema", schema: EXTRACT_SCHEMA as unknown as Record<string, unknown> },
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
    return normalizeExtract(JSON.parse(block.text));
  } catch {
    return null;
  }
}
