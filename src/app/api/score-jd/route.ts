import { NextResponse } from "next/server";

import {
  isScoringEnabled,
  loadScoreContext,
  looksLikeFullDescription,
  scoreJob,
  type JobMeta,
} from "@/lib/scorer";

/**
 * Score one pasted job description against every resume variant and say which
 * to send. Nothing is persisted — this is the "should I even apply, and with
 * which resume" check, separate from the batch scorer that runs over ingested
 * jobs.
 */
export async function POST(req: Request) {
  if (!isScoringEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set — scoring is disabled." },
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
  // Reject a truncated paste instead of scoring it — a partial copy still
  // yields a confident number, and a low score then reads as "bad job" when it
  // actually means "bad input".
  if (!looksLikeFullDescription(description) && body.force !== true) {
    const words = description.split(/\s+/).filter(Boolean).length;
    return NextResponse.json(
      {
        error: `Only ${words} words — that looks like a partial copy. Expand "Show more" on the posting and paste the whole description.`,
        truncated: true,
      },
      { status: 400 },
    );
  }

  const ctx = loadScoreContext();
  const job: JobMeta = {
    company: str("company") || "unknown",
    title: str("title") || "unknown",
    locations: str("location") ? [str("location")] : [],
    terms: [],
    locationFit: str("locationFit") || "unknown",
    salary: str("salary") || null,
    description,
  };

  const result = await scoreJob(job, ctx);
  if (!result) {
    return NextResponse.json(
      { error: "No usable response from the model (refusal or parse failure)." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ...result,
    variants: ctx.variants.map((v) => ({ id: v.id, label: v.label })),
  });
}
