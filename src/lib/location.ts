import { LOCATION_FIT, type LocationFit } from "./enums";

// Ported from scripts/find_jobs.py (reference only). The keyword sets are kept
// IDENTICAL to the Python so bucketing stays faithful; the classification
// ORDER follows SPEC.md where it diverges — see the US_REMOTE / US_ONSITE
// split in classifyLocation(), which find_jobs.py does not make.

// Top-tier companies: worth relocating for, so they get a rank bump (scoring.ts).
export const TOP_TIER = new Set<string>([
  "google", "alphabet", "meta", "facebook", "amazon", "aws", "apple",
  "microsoft", "netflix", "nvidia", "openai", "anthropic", "stripe",
  "databricks", "snowflake", "uber", "airbnb", "coinbase", "figma",
]);

// Vancouver metro (hit → highest priority).
export const VANCOUVER_KEYS = [
  "vancouver", "burnaby", "richmond", "surrey", "coquitlam",
  "north vancouver", "west vancouver", "new westminster",
  "british columbia", ", bc", " bc,", " bc ",
];

// Canada signals: province names/abbreviations + "canada" + major cities.
export const CANADA_KEYS = [
  "canada", "ontario", "quebec", "alberta", "manitoba", "saskatchewan",
  "nova scotia", "new brunswick", "newfoundland", "prince edward",
  "toronto", "ottawa", "montreal", "montréal", "calgary", "edmonton",
  "winnipeg", "waterloo", "kitchener", "mississauga", "halifax",
  ", on", ", qc", ", ab", ", mb", ", sk", ", ns", ", nb", ", pe", ", nl", ", bc",
];

// Crude US markers — identical set to find_jobs.py.
export const US_KEYS = [
  ", usa", "united states", ", ca", ", ny", ", wa", ", tx",
  ", ma", ", il", ", wa,", "seattle", "san francisco",
  "new york", "bellevue", "kirkland", "sunnyvale",
];

function has(text: string, keys: string[]): boolean {
  return keys.some((k) => text.includes(k));
}

export function isTopTier(company: string): boolean {
  return TOP_TIER.has(company.trim().toLowerCase());
}

export interface LocationClass {
  fit: LocationFit;
  relocation: boolean;
  isRemote: boolean;
}

/**
 * Classify a list of location strings into a fit bucket.
 *
 * Order (best → worst): Vancouver → Canada (remote|other) → US (remote|onsite)
 * → generic remote → other. Mirrors find_jobs.classify_location() except for
 * the US split, which SPEC.md requires: a US *remote* role that can hire from
 * Canada is in-scope (US_REMOTE), while US *on-site* needs a visa (US_ONSITE).
 * Python lumped every remote posting without a Canada signal into
 * "remote_generic"; we route remote+US to US_REMOTE first.
 */
export function classifyLocation(locations: string[]): LocationClass {
  const joined = locations.join(" | ").toLowerCase();
  const isRemote = joined.includes("remote");

  // 1. Vancouver metro — top priority (local).
  if (has(joined, VANCOUVER_KEYS)) {
    return { fit: LOCATION_FIT.VANCOUVER, relocation: false, isRemote };
  }
  // 2. Canada — remote first (no relocation), else relocate.
  if (has(joined, CANADA_KEYS)) {
    return isRemote
      ? { fit: LOCATION_FIT.CANADA_REMOTE, relocation: false, isRemote }
      : { fit: LOCATION_FIT.CANADA_OTHER, relocation: true, isRemote };
  }
  // 3. US — DEVIATION from find_jobs.py: split remote vs on-site.
  if (has(joined, US_KEYS)) {
    return isRemote
      ? { fit: LOCATION_FIT.US_REMOTE, relocation: false, isRemote }
      : { fit: LOCATION_FIT.US_ONSITE, relocation: true, isRemote };
  }
  // 4. Remote with no identified country — verify eligibility later.
  if (isRemote) {
    return { fit: LOCATION_FIT.REMOTE_GENERIC, relocation: false, isRemote };
  }
  // 5. Everything else: non-remote, outside detected North America.
  return { fit: LOCATION_FIT.OTHER, relocation: true, isRemote };
}
