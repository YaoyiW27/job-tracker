import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  deleteApplication,
  isValidStatus,
  updateApplication,
} from "@/lib/applications";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status !== undefined && !isValidStatus(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const updated = await updateApplication(id, {
      company: body.company as string | undefined,
      title: body.title as string | undefined,
      url: body.url as string | null | undefined,
      status: body.status as string | undefined,
      appliedDate: body.appliedDate as string | null | undefined,
      notes: body.notes as string | null | undefined,
      resumeVersion: body.resumeVersion as string | null | undefined,
      salary: body.salary as string | null | undefined,
      sortOrder: body.sortOrder as number | undefined,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await deleteApplication(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    throw err;
  }
}
