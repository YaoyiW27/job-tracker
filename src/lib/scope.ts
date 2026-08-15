import { LOCATION_FIT, type LocationFit } from "./enums";

// Scope gate + work-authorization flags, per SPEC.md. Nothing here DROPS a job
// — out-of-scope rows are kept, flagged (inScope=false), and demoted in the UI.
// "Rank, don't exclude."

// Signals that a role is freelance/part-time/contract.
const CONTRACT_KEYS = [
  "contract", "freelance", "part-time", "part time", "contractor",
  "temporary", "c2c",
];

// Signals a role may require PR / citizenship / security clearance.
const AUTH_RESTRICTION_KEYS = [
  "security clearance", " clearance", "permanent resident", " pr ",
  "citizen", "citizenship", "must be authorized", "must be a citizen",
];

export interface ScopeInput {
  fit: LocationFit;
  locations: string[];
  terms?: string[];
  title?: string;
  /** Any sponsorship/citizenship text already extracted from the raw record. */
  sponsorshipText?: string;
}

export interface ScopeResult {
  inScope: boolean;
  authFlags: string[];
}

function joinLower(...parts: (string | string[] | undefined)[]): string {
  return parts
    .flatMap((p) => (Array.isArray(p) ? p : p ? [p] : []))
    .join(" | ")
    .toLowerCase();
}

/** True when a posting is BOTH remote AND freelance/part-time/contract. */
export function isContractRemote(
  locations: string[],
  terms?: string[],
  title?: string,
): boolean {
  const text = joinLower(locations, terms, title);
  const remote = text.includes("remote");
  const contract = CONTRACT_KEYS.some((k) => text.includes(k));
  return remote && contract;
}

export function evaluateScope(input: ScopeInput): ScopeResult {
  const { fit, locations, terms, title, sponsorshipText } = input;
  const text = joinLower(locations, terms, title, sponsorshipText);
  const flags: string[] = [];

  // Location-derived verification flags.
  if (fit === LOCATION_FIT.REMOTE_GENERIC) {
    flags.push("verify Canada-eligible");
  }
  if (fit === LOCATION_FIT.US_REMOTE) {
    flags.push("verify work authorization (US remote — hires from Canada?)");
  }
  if (fit === LOCATION_FIT.US_ONSITE) {
    flags.push("US on-site — needs a visa (out of scope)");
  }

  // Canadian roles that may need PR / citizenship / clearance (flag, don't hide).
  const canadaBucket =
    fit === LOCATION_FIT.VANCOUVER ||
    fit === LOCATION_FIT.CANADA_REMOTE ||
    fit === LOCATION_FIT.BC_OTHER ||
    fit === LOCATION_FIT.CANADA_OTHER;
  if (canadaBucket && AUTH_RESTRICTION_KEYS.some((k) => text.includes(k))) {
    flags.push("verify: may require PR/citizenship/clearance");
  }

  // Scope gate: North America only, EXCEPT remote + freelance/contract anywhere.
  let inScope: boolean;
  switch (fit) {
    case LOCATION_FIT.VANCOUVER:
    case LOCATION_FIT.CANADA_REMOTE:
    case LOCATION_FIT.REMOTE_GENERIC:
    case LOCATION_FIT.BC_OTHER:
    case LOCATION_FIT.CANADA_OTHER:
    case LOCATION_FIT.US_REMOTE:
      inScope = true;
      break;
    case LOCATION_FIT.US_ONSITE:
      inScope = false; // on-site US needs a visa I don't have
      break;
    case LOCATION_FIT.OTHER:
    default:
      // Outside NA: keep only if remote + freelance/contract.
      inScope = isContractRemote(locations, terms, title);
      break;
  }

  return { inScope, authFlags: flags };
}
