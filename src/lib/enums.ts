// Enum value sets. SQLite (via Prisma) can't hold native enums, so these are
// the single source of truth for the string values stored in the DB.

export const ROLE_KIND = {
  NEW_GRAD: "NEW_GRAD",
  INTERN: "INTERN",
} as const;
export type RoleKind = (typeof ROLE_KIND)[keyof typeof ROLE_KIND];

// Ordered best -> worst; index doubles as `locationRank` for sorting.
export const LOCATION_FIT = {
  VANCOUVER: "VANCOUVER", // 0 — local
  CANADA_REMOTE: "CANADA_REMOTE", // 1
  REMOTE_GENERIC: "REMOTE_GENERIC", // 2 — verify Canada-eligible
  CANADA_OTHER: "CANADA_OTHER", // 3 — relocate; worth it only for top-tier
  US_REMOTE: "US_REMOTE", // 4 — verify hires-from-Canada + work auth
  US_ONSITE: "US_ONSITE", // 5 — out of scope (needs a visa), kept + flagged
  OTHER: "OTHER", // 6 — out unless remote + freelance/contract
} as const;
export type LocationFit = (typeof LOCATION_FIT)[keyof typeof LOCATION_FIT];

export const LOCATION_RANK: Record<LocationFit, number> = {
  VANCOUVER: 0,
  CANADA_REMOTE: 1,
  REMOTE_GENERIC: 2,
  CANADA_OTHER: 3,
  US_REMOTE: 4,
  US_ONSITE: 5,
  OTHER: 6,
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
