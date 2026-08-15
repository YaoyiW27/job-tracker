// Colour per application status, mirroring the convention from the spreadsheet
// this app replaced.
//
// Hue carries the category, shade carries the progress:
//   blue   = saved, not sent yet        (a different kind of thing, not a stage)
//   plain  = applied and waiting        (the baseline; no signal is no news)
//   green  = moving, deepening OA -> interview -> offer
//   grey   = over, and muted so live rows read first
//
// The greens stay one family on purpose — different hues per stage would lose
// the "deeper means further along" reading. Kept low-saturation (green, not
// emerald, at reduced alpha) so a full table doesn't glow.
//
// Tailwind needs these class strings to appear literally in the source, so they
// are spelled out rather than composed at runtime.

import { APP_STATUS, type AppStatus } from "./enums";

export interface StatusStyle {
  /** Table row background (and muted text for the dead states). */
  row: string;
  /** Small colour chip used on Kanban column headers. */
  dot: string;
  /** Kanban column background. */
  column: string;
}

const STYLES: Record<AppStatus, StatusStyle> = {
  // Not sent yet — distinct from "sent and waiting", which is the plain row.
  SAVED: {
    row: "bg-sky-50 dark:bg-sky-950/30",
    dot: "bg-sky-400",
    column: "bg-sky-50/70 dark:bg-sky-950/20",
  },
  APPLIED: {
    row: "",
    dot: "bg-neutral-400",
    column: "bg-transparent",
  },
  OA: {
    row: "bg-green-50/70 dark:bg-green-950/25",
    dot: "bg-green-400",
    column: "bg-green-50/50 dark:bg-green-950/15",
  },
  INTERVIEW: {
    row: "bg-green-100/60 dark:bg-green-900/25",
    dot: "bg-green-500",
    column: "bg-green-100/40 dark:bg-green-900/15",
  },
  OFFER: {
    row: "bg-green-200/60 dark:bg-green-800/30",
    dot: "bg-green-600",
    column: "bg-green-200/40 dark:bg-green-800/20",
  },
  REJECTED: {
    row: "bg-neutral-200/70 text-muted-foreground dark:bg-neutral-800/60",
    dot: "bg-neutral-400 dark:bg-neutral-500",
    column: "bg-neutral-200/50 dark:bg-neutral-800/40",
  },
  // Never answered. Lighter than an explicit rejection — it is still ambiguous.
  GHOSTED: {
    row: "bg-neutral-100/60 text-muted-foreground dark:bg-neutral-800/25",
    dot: "bg-neutral-300 dark:bg-neutral-700",
    column: "bg-neutral-100/40 dark:bg-neutral-800/15",
  },
};

const FALLBACK: StatusStyle = { row: "", dot: "bg-neutral-400", column: "bg-transparent" };

/** Style for a status string from the DB, tolerant of an unknown value. */
export function statusStyle(status: string): StatusStyle {
  return STYLES[status as AppStatus] ?? FALLBACK;
}

export const ALL_STATUSES = Object.values(APP_STATUS);
