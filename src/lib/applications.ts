import { db } from "./db";
import { APP_STATUS, type AppStatus } from "./enums";

export function isValidStatus(s: unknown): s is AppStatus {
  return typeof s === "string" && s in APP_STATUS;
}

/** Parse a date-ish input (ISO / yyyy-mm-dd) to a Date, or null. */
export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

const norm = (s: string) => s.trim().toLowerCase();

export interface DuplicateMatch {
  id: string;
  company: string;
  title: string;
  url: string | null;
  status: string;
}

export interface DuplicateInput {
  url?: string | null;
  company: string;
  title: string;
}

/**
 * Pure duplicate matcher over a set of rows: same url (if given), else same
 * company + title, all case-insensitive. Exported for unit testing without a DB.
 */
export function findDuplicateIn(
  rows: DuplicateMatch[],
  input: DuplicateInput,
): DuplicateMatch | null {
  const url = input.url ? norm(input.url) : null;
  const company = norm(input.company);
  const title = norm(input.title);
  return (
    rows.find(
      (r) =>
        (url && r.url && norm(r.url) === url) ||
        (norm(r.company) === company && norm(r.title) === title),
    ) ?? null
  );
}

/**
 * Find an existing application that looks like a duplicate. SQLite has no
 * case-insensitive Prisma filter, and the applications table is personal-scale,
 * so we fetch and compare in JS via findDuplicateIn().
 */
export async function findDuplicate(input: DuplicateInput): Promise<DuplicateMatch | null> {
  const rows = await db.application.findMany({
    select: { id: true, company: true, title: true, url: true, status: true },
  });
  return findDuplicateIn(rows, input);
}

export async function listApplications() {
  return db.application.findMany({ orderBy: { updatedAt: "desc" } });
}

/** Find the application already linked to a job (jobId is 1:1), if any. */
export async function findApplicationByJobId(jobId: string): Promise<DuplicateMatch | null> {
  return db.application.findUnique({
    where: { jobId },
    select: { id: true, company: true, title: true, url: true, status: true },
  });
}

export interface CreateApplicationInput {
  company: string;
  title: string;
  url?: string | null;
  status?: string;
  appliedDate?: string | null;
  notes?: string | null;
  resumeVersion?: string | null;
  salary?: string | null;
  jobId?: string | null;
}

export async function createApplication(input: CreateApplicationInput) {
  const status: AppStatus = isValidStatus(input.status)
    ? input.status
    : APP_STATUS.SAVED;
  return db.application.create({
    data: {
      company: input.company.trim(),
      title: input.title.trim(),
      url: input.url?.trim() || null,
      status,
      appliedDate: parseDate(input.appliedDate),
      notes: input.notes ?? null,
      resumeVersion: input.resumeVersion ?? null,
      salary: input.salary ?? null,
      jobId: input.jobId ?? null,
    },
  });
}

export interface UpdateApplicationInput {
  company?: string;
  title?: string;
  url?: string | null;
  status?: string;
  appliedDate?: string | null;
  notes?: string | null;
  resumeVersion?: string | null;
  salary?: string | null;
  sortOrder?: number;
}

export async function updateApplication(id: string, patch: UpdateApplicationInput) {
  const data: Record<string, unknown> = {};
  if (patch.company !== undefined) data.company = patch.company.trim();
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.url !== undefined) data.url = patch.url?.trim() || null;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.appliedDate !== undefined) data.appliedDate = parseDate(patch.appliedDate);
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.resumeVersion !== undefined) data.resumeVersion = patch.resumeVersion;
  if (patch.salary !== undefined) data.salary = patch.salary;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
  return db.application.update({ where: { id }, data });
}

export async function deleteApplication(id: string) {
  return db.application.delete({ where: { id } });
}
