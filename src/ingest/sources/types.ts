import type { RoleKind } from "../../lib/enums";

// A raw posting straight from a source feed — schema-tolerant, read defensively.
export type RawListing = Record<string, unknown>;

/**
 * The ingest seam. Adding a new source (Greenhouse/Lever/Ashby, a raw ATS
 * feed, etc.) means implementing this interface and adding one line to
 * registry.ts — the orchestrator (index.ts) needs no changes.
 */
export interface Source {
  /** Stable id stored on Job.source, e.g. "simplify:new-grad". */
  key: string;
  /** Human-readable label for logs. */
  label: string;
  /** Role kind every posting from this source is tagged with. */
  roleKind: RoleKind;
  /** Fetch and return the raw listing records. */
  fetch(): Promise<RawListing[]>;
}
