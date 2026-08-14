import { NextResponse } from "next/server";
import {
  createApplication,
  findDuplicate,
  isValidStatus,
  listApplications,
} from "@/lib/applications";

export async function GET() {
  const apps = await listApplications();
  return NextResponse.json(apps);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const company = typeof body.company === "string" ? body.company.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!company || !title) {
    return NextResponse.json(
      { error: "company and title are required" },
      { status: 400 },
    );
  }
  if (body.status !== undefined && !isValidStatus(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : null;
  const force = body.force === true;

  const dup = await findDuplicate({ url, company, title });
  if (dup && !force) {
    // Warn, don't block: client can re-POST with force=true to confirm.
    return NextResponse.json({ duplicate: true, existing: dup }, { status: 409 });
  }

  const created = await createApplication({
    company,
    title,
    url,
    status: body.status as string | undefined,
    appliedDate: body.appliedDate as string | null | undefined,
    notes: body.notes as string | null | undefined,
    resumeVersion: body.resumeVersion as string | null | undefined,
    salary: body.salary as string | null | undefined,
    jobId: body.jobId as string | null | undefined,
  });
  return NextResponse.json(created, { status: 201 });
}
