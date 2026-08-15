import { NextResponse } from "next/server";
import { PrefillError, prefillFromUrl } from "@/lib/prefill";
import { extractFromText, isExtractionEnabled } from "@/lib/prefill-text";

/**
 * Two ways in, one response shape ({ company, title, salary, via, error? }):
 *
 *   { url }  — fetch the page and read its metadata. Free, but useless against
 *              sites that answer a server-side fetch with a bot check.
 *   { text } — pull the same fields out of a pasted posting with a model call.
 *              The fallback for IBM / LinkedIn / Workday and friends.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (text) {
    if (!isExtractionEnabled()) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set — pasting a posting needs it. Use a URL, or type it in." },
        { status: 503 },
      );
    }
    const result = await extractFromText(text);
    if (!result) {
      // Soft failure, same as the URL path: blanks plus a reason, so the dialog
      // stays usable instead of dead-ending.
      return NextResponse.json(
        {
          company: "",
          title: "",
          salary: null,
          location: null,
          via: [],
          error: "could not read that posting",
        },
        { status: 200 },
      );
    }
    return NextResponse.json({
      company: result.company ?? "",
      title: result.title ?? "",
      salary: result.salary,
      location: result.location,
      via: ["pasted text"],
    });
  }

  if (!url) {
    return NextResponse.json({ error: "url or text is required" }, { status: 400 });
  }

  try {
    const result = await prefillFromUrl(url);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PrefillError) {
      return NextResponse.json(
        { company: "", title: "", salary: null, location: null, via: [], error: err.message },
        { status: 200 },
      );
    }
    throw err;
  }
}
