// Pure helpers for inline-editing applications in the Tracker table: normalize a
// row into editable string fields, and diff an edited row down to a minimal
// PATCH body. No I/O — unit-tested in tests/application-edit.test.ts.

export const EDITABLE_FIELDS = [
  "company",
  "title",
  "status",
  "url",
  "appliedDate",
  "location",
  "salary",
  "notes",
  "resumeVersion",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type EditableRow = Record<EditableField, string>;

export interface AppLike {
  company: string;
  title: string;
  status: string;
  url: string | null;
  appliedDate: string | Date | null;
  location: string | null;
  salary: string | null;
  notes: string | null;
  resumeVersion: string | null;
}

export function dateToYmd(v: string | Date | null): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Normalize an application into all-string editable fields (nulls → ""). */
export function toEditableRow(app: AppLike): EditableRow {
  return {
    company: app.company ?? "",
    title: app.title ?? "",
    status: app.status ?? "",
    url: app.url ?? "",
    appliedDate: dateToYmd(app.appliedDate),
    location: app.location ?? "",
    salary: app.salary ?? "",
    notes: app.notes ?? "",
    resumeVersion: app.resumeVersion ?? "",
  };
}

/**
 * Today as yyyy-mm-dd in the *local* calendar. Deliberately not
 * `toISOString().slice(0, 10)`: west of UTC that returns tomorrow's date all
 * evening, which would stamp the wrong day on anything applied to after ~5pm.
 */
export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Moving a row out of SAVED means it was applied to, so stamp today's date when
 * none is set — the moment the status changes IS the information. Covers a drag
 * straight to INTERVIEW (you can't interview without applying) and never
 * overwrites a date the user set, here or earlier. The dashboard's cumulative
 * chart is keyed on appliedDate, so a missing one silently drops the row.
 */
export function withAppliedDateDefault(
  patch: Partial<EditableRow>,
  original: Pick<EditableRow, "appliedDate">,
  today: string = todayYmd(),
): Partial<EditableRow> {
  const status = patch.status;
  if (!status || status === "SAVED") return patch;
  if (original.appliedDate.trim() || patch.appliedDate?.trim()) return patch;
  return { ...patch, appliedDate: today };
}

/**
 * Applied date for a row being *created*. Same rule as withAppliedDateDefault,
 * but it answers with the value to store rather than a patch — the create path
 * has no "original" to diff against, and reading an absent patch field there
 * silently threw away the date the user had typed.
 */
export function appliedDateForNewRow(
  status: string,
  appliedDate: string,
  today: string = todayYmd(),
): string | null {
  const typed = appliedDate.trim();
  if (typed) return typed;
  return status && status !== "SAVED" ? today : null;
}

/**
 * Diff an edited row against the original, returning only changed fields with
 * trimmed values. Whitespace-only changes are ignored.
 */
export function buildPatch(original: EditableRow, edited: EditableRow): Partial<EditableRow> {
  const patch: Partial<EditableRow> = {};
  for (const field of EDITABLE_FIELDS) {
    const before = original[field].trim();
    const after = edited[field].trim();
    if (before !== after) patch[field] = after;
  }
  return patch;
}
