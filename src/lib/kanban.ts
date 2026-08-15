import { APP_STATUS, type AppStatus } from "./enums";
import { dateToYmd, withAppliedDateDefault, type EditableRow } from "./application-edit";

// Pure helpers for the Kanban board: column order, grouping, and computing the
// patch when a card is dragged to a new column. Unit-tested in tests/kanban.test.ts.

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
