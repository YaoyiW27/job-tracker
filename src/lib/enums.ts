// Enum value sets. SQLite (via Prisma) can't hold native enums, so these are
// the single source of truth for the string values stored in the DB.

export const ROLE_KIND = {
  NEW_GRAD: "NEW_GRAD",
  INTERN: "INTERN",
} as const;
export type RoleKind = (typeof ROLE_KIND)[keyof typeof ROLE_KIND];

// Ordered best -> worst; index doubles as `locationRank` for sorting.
export const LOCATION_FIT = {
  VANCOUVER: "VANCOUVER", // 0 — Metro Vancouver: no move
  CANADA_REMOTE: "CANADA_REMOTE", // 1
  REMOTE_GENERIC: "REMOTE_GENERIC", // 2 — verify Canada-eligible
  BC_OTHER: "BC_OTHER", // 3 — rest of BC (Victoria, Kelowna…): move, but in-province
  CANADA_OTHER: "CANADA_OTHER", // 4 — relocate cross-country; worth it only for top-tier
  US_REMOTE: "US_REMOTE", // 5 — verify hires-from-Canada + work auth
  US_ONSITE: "US_ONSITE", // 6 — out of scope (needs a visa), kept + flagged
  OTHER: "OTHER", // 7 — out unless remote + freelance/contract
} as const;
export type LocationFit = (typeof LOCATION_FIT)[keyof typeof LOCATION_FIT];

// Ranks 3+ are the "requires relocation" tiers — scoring.ts keys the top-tier
// bump off that threshold, so keep any new relocation bucket at 3 or below it.
export const LOCATION_RANK: Record<LocationFit, number> = {
  VANCOUVER: 0,
  CANADA_REMOTE: 1,
  REMOTE_GENERIC: 2,
  BC_OTHER: 3,
  CANADA_OTHER: 4,
  US_REMOTE: 5,
  US_ONSITE: 6,
  OTHER: 7,
};

export const APP_STATUS = {
  SAVED: "SAVED",
  APPLIED: "APPLIED",
  OA: "OA",
  INTERVIEW: "INTERVIEW",
  OFFER: "OFFER",
  REJECTED: "REJECTED",
  GHOSTED: "GHOSTED",
} as const;
export type AppStatus = (typeof APP_STATUS)[keyof typeof APP_STATUS];

// Statuses considered "past APPLIED" for the dashboard response-rate metric.
export const RESPONDED_STATUSES: AppStatus[] = [
  "OA",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
];
