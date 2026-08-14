import { NextResponse } from "next/server";
import { parseJobQuery } from "@/lib/job-query";
import { listJobs } from "@/lib/jobs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = parseJobQuery(url.searchParams);
  const result = await listJobs(query);
  return NextResponse.json(result);
}
