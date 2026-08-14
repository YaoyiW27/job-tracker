import type { RawListing, Source } from "./sources/types";

// Schema-tolerant field reads. The Simplify dataset occasionally adds/renames
// fields, so we read defensively and keep the full raw record (rawJson) too.
// Ports first_present() / sponsorship_note() from scripts/find_jobs.py.

/** First field in `names` that exists and is non-empty; else `def`. */
export function firstPresent(rec: RawListing, names: string[], def: unknown): unknown {
  for (const n of names) {
    if (n in rec) {
      const v = rec[n];
      const empty =
        v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
      if (!empty) return v;
    }
  }
  return def;
}

export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string" && v) return [v];
  return [];
}

/** Unix seconds (or ms) → Date, tolerant of strings/garbage. */
export function unixToDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000; // heuristic: seconds vs milliseconds
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Best-effort sponsorship/citizenship signal from any matching key. */
export function sponsorshipNote(rec: RawListing): string | null {
  for (const key of Object.keys(rec)) {
    const lk = key.toLowerCase();
    if (lk.includes("sponsor") || lk.includes("citizen")) {
      const val = rec[key];
      if (typeof val === "boolean") return `${key}=${val}`;
      if (val !== null && val !== undefined && val !== "") return String(val);
    }
  }
  return null;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface Extracted {
  source: string;
  externalId: string | null;
  company: string;
  companyUrl: string | null;
  title: string;
  locations: string[];
  url: string;
  datePosted: Date | null;
  dateUpdated: Date | null;
  active: boolean;
  isVisible: boolean;
  terms: string[];
  category: string | null;
  salary: string | null;
  sponsorshipNote: string | null;
  raw: RawListing;
}

/**
 * Pull normalized fields out of a raw record. Returns null when the record
 * lacks the minimum (company + title) to be usable.
 *
 * Dedupe key: we use `url`. When a record has no apply URL we synthesize a
 * stable `urn:<source>:<id|slug>` so the unique constraint still holds and
 * re-ingest dedupes on the record's own id, else on company+title (SPEC's
 * "dedupe on url, else company + title").
 */
export function extractListing(raw: RawListing, source: Source): Extracted | null {
  const company = String(firstPresent(raw, ["company_name", "company"], "")).trim();
  const title = String(firstPresent(raw, ["title", "role"], "")).trim();
  if (!company || !title) return null;

  const externalId = raw.id != null ? String(raw.id) : null;
  const locations = toStringArray(firstPresent(raw, ["locations", "location"], []));

  let url = String(firstPresent(raw, ["url", "company_url"], "")).trim();
  if (!url) {
    url = `urn:${source.key}:${externalId ?? slugify(`${company} ${title}`)}`;
  }

  const companyUrlRaw = firstPresent(raw, ["company_url"], null);
  const categoryRaw = firstPresent(raw, ["category", "categories"], null);
  const salaryRaw = firstPresent(
    raw,
    ["salary", "salary_range", "compensation", "pay"],
    null,
  );

  return {
    source: source.key,
    externalId,
    company,
    companyUrl: companyUrlRaw ? String(companyUrlRaw) : null,
    title,
    locations,
    url,
    datePosted: unixToDate(firstPresent(raw, ["date_posted", "date_updated"], null)),
    dateUpdated: unixToDate(firstPresent(raw, ["date_updated"], null)),
    active: raw.active !== false, // default true when absent
    isVisible: raw.is_visible !== false,
    terms: toStringArray(firstPresent(raw, ["terms"], [])),
    category: Array.isArray(categoryRaw)
      ? categoryRaw.map(String).join(", ")
      : categoryRaw
        ? String(categoryRaw)
        : null,
    salary: salaryRaw ? String(salaryRaw) : null,
    sponsorshipNote: sponsorshipNote(raw),
    raw,
  };
}
