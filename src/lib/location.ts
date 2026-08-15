import { LOCATION_FIT, type LocationFit } from "./enums";

// Location bucketing. Ported from scripts/find_jobs.py but corrected for the
// ambiguous-city bug: bare metro-Vancouver names (Richmond, Surrey, even
// Vancouver itself) also name US/UK cities, so we require a BC/Canada context
// and detect US state codes with word boundaries. SPEC.md governs where this
// diverges from the reference Python.

// Top-tier companies: worth relocating for, so they get a rank bump (scoring.ts).
export const TOP_TIER = new Set<string>([
  "google", "alphabet", "meta", "facebook", "amazon", "aws", "apple",
  "microsoft", "netflix", "nvidia", "openai", "anthropic", "stripe",
  "databricks", "snowflake", "uber", "airbnb", "coinbase", "figma",
]);

// Distinctively metro-Vancouver names (Vancouver WA is the one exception, caught
// by the US check). Safe to bucket as Vancouver even without a BC signal.
const VAN_STRONG = [
  "vancouver", "burnaby", "coquitlam", "new westminster",
  "north vancouver", "west vancouver", "port coquitlam", "port moody",
];
// Metro-Vancouver names that ALSO name US/UK cities — only Vancouver with a BC
// signal, never on their own.
const VAN_AMBIGUOUS = ["richmond", "surrey", "delta", "langley"];

const BC_KEYS = ["british columbia", ", bc", " bc,", " bc ", " b.c."];

// Canada signals: province names/abbreviations + "canada" + major cities.
export const CANADA_KEYS = [
  "canada", "ontario", "quebec", "alberta", "manitoba", "saskatchewan",
  "nova scotia", "new brunswick", "newfoundland", "prince edward",
  "toronto", "ottawa", "montreal", "montréal", "calgary", "edmonton",
  "winnipeg", "waterloo", "kitchener", "mississauga", "halifax",
  ", on", ", qc", ", ab", ", mb", ", sk", ", ns", ", nb", ", pe", ", nl", ", bc",
];

// US state postal codes (50 + DC), EXCLUDING Canadian province codes (no overlap).
const US_STATE_CODES = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id",
  "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms",
  "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok",
  "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv",
  "wi", "wy", "dc",
];
// ", va" but NOT ", vancouver"; ", ca" but NOT ", canada" — word boundary after the code.
const US_STATE_RE = new RegExp(`,\\s*(?:${US_STATE_CODES.join("|")})\\b`, "i");
const US_CITY_KEYS = [
  ", usa", "united states", "seattle", "san francisco",
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
 * A metro-Vancouver name is only VANCOUVER with a BC signal, or when it's an
 * unambiguous BC name with no US signal — so "Richmond, VA" / "Vancouver, WA"
 * bucket as US, while "Richmond, BC" stays Vancouver. Explicit Canada beats US
 * for multi-region posts. US split into remote/on-site per SPEC.md.
 */
export function classifyLocation(locations: string[]): LocationClass {
  const joined = locations.join(" | ").toLowerCase();
  const isRemote = joined.includes("remote");

  const hasBC = has(joined, BC_KEYS);
  const hasUS = US_STATE_RE.test(joined) || has(joined, US_CITY_KEYS);
  const hasCanada = hasBC || has(joined, CANADA_KEYS);
  const vanStrong = has(joined, VAN_STRONG);
  const vanCity = vanStrong || has(joined, VAN_AMBIGUOUS);

  // 1. Vancouver metro — needs BC context, or an unambiguous metro name with no US signal.
  if (vanCity && hasBC) return { fit: LOCATION_FIT.VANCOUVER, relocation: false, isRemote };
  if (vanStrong && !hasUS) return { fit: LOCATION_FIT.VANCOUVER, relocation: false, isRemote };

  // 2. Canada (explicit) — beats US for multi-region posts.
  if (hasCanada) {
    return isRemote
      ? { fit: LOCATION_FIT.CANADA_REMOTE, relocation: false, isRemote }
      : { fit: LOCATION_FIT.CANADA_OTHER, relocation: true, isRemote };
  }

  // 3. US — remote can hire from Canada; on-site needs a visa.
  if (hasUS) {
    return isRemote
      ? { fit: LOCATION_FIT.US_REMOTE, relocation: false, isRemote }
      : { fit: LOCATION_FIT.US_ONSITE, relocation: true, isRemote };
  }

  // 4. Remote with no identified country — verify eligibility later.
  if (isRemote) return { fit: LOCATION_FIT.REMOTE_GENERIC, relocation: false, isRemote };

  // 5. Everything else: non-remote, outside detected North America.
  return { fit: LOCATION_FIT.OTHER, relocation: true, isRemote };
}
