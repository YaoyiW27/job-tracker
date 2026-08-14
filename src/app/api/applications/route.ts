import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  createApplication,
  findApplicationByJobId,
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
  const jobId = typeof body.jobId === "string" ? body.jobId : null;
  const force = body.force === true;

  // A job can be linked to at most one application (jobId is 1:1). If it's
  // already saved, that's a hard duplicate — force can't override it.
  if (jobId) {
    const already = await findApplicationByJobId(jobId);
    if (already) {
      return NextResponse.json(
        { duplicate: true, reason: "already-saved", existing: already },
        { status: 409 },
      );
    }
  }

  // Soft duplicate on url / company+title — warn unless the caller forces.
  const dup = await findDuplicate({ url, company, title });
  if (dup && !force) {
    return NextResponse.json(
      { duplicate: true, reason: "match", existing: dup },
      { status: 409 },
    );
  }

  try {
    const created = await createApplication({
      company,
      title,
      url,
      status: body.status as string | undefined,
      appliedDate: body.appliedDate as string | null | undefined,
      notes: body.notes as string | null | undefined,
      resumeVersion: body.resumeVersion as string | null | undefined,
      salary: body.salary as string | null | undefined,
      jobId,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    // Race: the job got linked between our check and insert.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = jobId ? await findApplicationByJobId(jobId) : null;
      return NextResponse.json(
        { duplicate: true, reason: "already-saved", existing },
        { status: 409 },
      );
    }
    throw err;
  }
}
