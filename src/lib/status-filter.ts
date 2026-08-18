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

/**
 * "Applied" means *sent*, so it covers every later state too — an application
 * that has since been rejected was still applied to. Counting it as the current
 * stage made "Applied · 8" appear after twelve were sent and four bounced. The
 * dashboard already reads it this way (status !== SAVED); this matches it.
 *
 * The chips therefore overlap on purpose: 12 applied, of which 2 are at OA.
 */
export function matchesFilter(row: { status: string }, status: string | null): boolean {
  if (!status) return true;
  if (status === APP_STATUS.APPLIED) return row.status !== APP_STATUS.SAVED;
  return row.status === status;
}

/** How many rows a chip would show — not the same as countByStatus for APPLIED. */
export function chipCount(rows: { status: string }[], status: string): number {
  return rows.filter((r) => matchesFilter(r, status)).length;
}

/** Narrow to one status, or return everything when nothing is selected. */
export function filterByStatus<T extends { status: string }>(
  rows: T[],
  status: string | null,
): T[] {
  return status ? rows.filter((r) => matchesFilter(r, status)) : rows;
}
