// Status chips above the tracker table, LinkedIn-style: one row of counts, click
// one to narrow the table to it.
//
// Only the live states get a chip. Rejected and ghosted are history — they stay
// in the unfiltered table, but a quick-jump target for "things that are over"
// isn't what you reach for while applying.

import { APP_STATUS, type AppStatus } from "./enums";

export const FILTER_STATUSES: AppStatus[] = [
  APP_STATUS.SAVED,
  APP_STATUS.APPLIED,
  APP_STATUS.OA,
  APP_STATUS.INTERVIEW,
  APP_STATUS.OFFER,
];

/** Count per status, including the ones without a chip. Zeroes are present. */
export function countByStatus(rows: { status: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of Object.values(APP_STATUS)) counts[s] = 0;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

/** Narrow to one status, or return everything when nothing is selected. */
export function filterByStatus<T extends { status: string }>(
  rows: T[],
  status: string | null,
): T[] {
  return status ? rows.filter((r) => r.status === status) : rows;
}
