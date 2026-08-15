import { APP_STATUS, type AppStatus } from "./enums";
import { dateToYmd, withAppliedDateDefault, type EditableRow } from "./application-edit";

// Pure helpers for the Kanban board: column order, grouping, and computing the
// patch when a card is dragged to a new column. Unit-tested in tests/kanban.test.ts.

/**
 * Board layout: three rows instead of one horizontally-scrolling strip, so the
 * whole pipeline is visible at once. Grouped by what you'd do about it — still
 * waiting on you/them, actually moving, or over.
 */
export const BOARD_GROUPS: { label: string; statuses: AppStatus[] }[] = [
  { label: "Waiting", statuses: [APP_STATUS.SAVED, APP_STATUS.APPLIED] },
  { label: "Heard back", statuses: [APP_STATUS.OA, APP_STATUS.INTERVIEW] },
  { label: "Closed", statuses: [APP_STATUS.OFFER, APP_STATUS.REJECTED, APP_STATUS.GHOSTED] },
];

export const STATUS_ORDER: AppStatus[] = [
  APP_STATUS.SAVED,
  APP_STATUS.APPLIED,
  APP_STATUS.OA,
  APP_STATUS.INTERVIEW,
  APP_STATUS.OFFER,
  APP_STATUS.REJECTED,
  APP_STATUS.GHOSTED,
];

/** Bucket cards by status into every column (empty columns included), input order preserved. */
export function groupByStatus<T extends { status: string }>(apps: T[]): Record<AppStatus, T[]> {
  const groups = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as T[]])) as Record<
    AppStatus,
    T[]
  >;
  for (const app of apps) {
    const col = groups[app.status as AppStatus];
    if (col) col.push(app);
  }
  return groups;
}

/**
 * Pipeline position, for sorting the Status column. Alphabetical order puts
 * GHOSTED between APPLIED and INTERVIEW, which says nothing about where an
 * application stands. Unknown values sort last rather than first.
 */
export function statusRank(status: string): number {
  const i = (STATUS_ORDER as string[]).indexOf(status);
  return i === -1 ? STATUS_ORDER.length : i;
}

/**
 * Which board columns render a full card. Saved and applied grow into the
 * hundreds over a search and are read as a count; rejected and ghosted are
 * history. The few columns that need action get the detail.
 */
const DETAIL_STATUSES = new Set<string>([APP_STATUS.OA, APP_STATUS.INTERVIEW, APP_STATUS.OFFER]);

export function showsDetail(status: string): boolean {
  return DETAIL_STATUSES.has(status);
}

/** Patch to apply when a card is dropped on a column, or null if unchanged. */
export function movePatch(
  card: { status: string; appliedDate: string | Date | null },
  toStatus: string,
  today?: string,
): Partial<EditableRow> | null {
  if (card.status === toStatus) return null;
  // Dragging out of SAVED is an "I applied" signal too — same rule as the table.
  return withAppliedDateDefault(
    { status: toStatus },
    { appliedDate: dateToYmd(card.appliedDate) },
    today,
  );
}
