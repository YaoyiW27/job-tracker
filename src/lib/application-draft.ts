// Pure helpers for the Tracker "Add row" dialog: turn a raw prefill result into
// clean form fields, validate the draft, and interpret the create response.
// All pure (no I/O) so the dialog's important behavior is unit-tested.

import type { DuplicateMatch } from "./applications";

export interface PrefillLike {
  company: string;
  title: string;
  salary?: string | null;
}

// Title/company separators, longest/most-specific first.
const SEPARATORS = [" — ", " – ", " - ", " | ", " · ", " at ", ": "];

// Segments that are site boilerplate, not a real company name.
const BOILERPLATE = new Set([
  "careers", "career", "jobs", "job", "job application", "apply", "hiring",
  "openings", "current openings", "we're hiring", "join us",
]);

function isBoilerplate(s: string): boolean {
  return BOILERPLATE.has(s.trim().toLowerCase());
}

/**
 * Clean a prefill result into form-ready { company, title }. When company is
 * missing, try to split it out of the title on a common separator (e.g.
 * "Backend Engineer - Acme"). Boilerplate tails ("Careers") are dropped, not
 * used as a company. If company is already set, the title is left untouched.
 */
export function cleanPrefill(raw: PrefillLike): {
  company: string;
  title: string;
  salary: string | null;
} {
  const salary = raw.salary?.trim() || null;
  let company = raw.company.trim();
  let title = raw.title.trim();

  if (!company && title) {
    for (const sep of SEPARATORS) {
      const idx = title.indexOf(sep);
      if (idx === -1) continue;
      const left = title.slice(0, idx).trim();
      const right = title.slice(idx + sep.length).trim();
      if (!left || !right) continue;
      title = left;
      company = isBoilerplate(right) ? "" : right;
      break;
    }
  }

  return { company, title, salary };
}

export interface ApplicationDraftInput {
  company: string;
  title: string;
}

export interface DraftValidation {
  ok: boolean;
  errors: { company?: string; title?: string };
}

export function validateDraft(draft: ApplicationDraftInput): DraftValidation {
  const errors: { company?: string; title?: string } = {};
  if (!draft.company.trim()) errors.company = "Company is required";
  if (!draft.title.trim()) errors.title = "Title is required";
  return { ok: Object.keys(errors).length === 0, errors };
}

export type CreateOutcome =
  | { kind: "created"; application: unknown }
  | { kind: "duplicate"; existing: DuplicateMatch }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

/** Interpret the POST /api/applications response by status code. */
export function interpretCreateResponse(status: number, body: unknown): CreateOutcome {
  if (status === 201) return { kind: "created", application: body };
  if (status === 409) {
    const existing = (body as { existing: DuplicateMatch }).existing;
    return { kind: "duplicate", existing };
  }
  if (status === 400) {
    const message = (body as { error?: string }).error ?? "Invalid input";
    return { kind: "invalid", message };
  }
  return { kind: "error", message: "Something went wrong. Please try again." };
}
