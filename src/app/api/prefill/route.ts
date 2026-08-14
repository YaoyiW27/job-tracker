import { NextResponse } from "next/server";
import { PrefillError, prefillFromUrl } from "@/lib/prefill";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const result = await prefillFromUrl(url);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PrefillError) {
      // Soft failure: return blanks + a note so the user can still fill manually.
      return NextResponse.json(
        { company: "", title: "", salary: null, via: [], error: err.message },
        { status: 200 },
      );
    }
    throw err;
  }
}
