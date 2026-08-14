// Pure helpers for inline-editing applications in the Tracker table: normalize a
// row into editable string fields, and diff an edited row down to a minimal
// PATCH body. No I/O — unit-tested in tests/application-edit.test.ts.

export const EDITABLE_FIELDS = [
  "company",
  "title",
  "status",
  "url",
  "appliedDate",
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
  salary: string | null;
  notes: string | null;
  resumeVersion: string | null;
}

function dateToYmd(v: string | Date | null): string {
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
    salary: app.salary ?? "",
    notes: app.notes ?? "",
    resumeVersion: app.resumeVersion ?? "",
  };
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
