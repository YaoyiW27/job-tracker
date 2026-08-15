import { NextResponse } from "next/server";

import { draftAnswer } from "@/lib/answer";
import {
  isScoringEnabled,
  loadScoreContext,
  looksLikeFullDescription,
  countWords,
  ScoreContextError,
} from "@/lib/scorer";

/**
 * Draft one application-form answer from a pasted posting. Nothing is stored —
 * the draft is for review, then copy-paste.
 *
 * `resumeId` should be whatever /api/score-jd picked, so the answer argues from
 * the same résumé the application will actually send.
 */
export async function POST(req: Request) {
  if (!isScoringEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — drafting answers needs it." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const description = str("description");
  if (!description) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  // Same guard as scoring: a partial copy produces a confident, wrong answer —
  // it would cite "the role" from a page fragment that never described it.
  if (!looksLikeFullDescription(description) && body.force !== true) {
    return NextResponse.json(
      {
        error: `Only ${countWords(description)} words — that looks like a partial copy. Paste the whole posting.`,
        truncated: true,
      },
      { status: 400 },
    );
  }

  let ctx;
  try {
    ctx = loadScoreContext();
  } catch (err) {
    if (err instanceof ScoreContextError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  const wanted = str("resumeId");
  const variant = ctx.variants.find((v) => v.id === wanted) ?? ctx.variants[0];

  const result = await draftAnswer(
    {
      question: str("question"),
      description,
      company: str("company"),
      notes: str("notes"),
    },
    { preferences: ctx.preferences, style: ctx.style, variant },
  );

  if (!result) {
    return NextResponse.json(
      { error: "No usable response from the model (refusal or parse failure)." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ...result, resumeUsed: { id: variant.id, label: variant.label } });
}
