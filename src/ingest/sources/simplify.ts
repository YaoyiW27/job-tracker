import type { RoleKind } from "../../lib/enums";
import type { RawListing, Source } from "./types";

export interface SimplifyConfig {
  key: string;
  label: string;
  url: string;
  roleKind: RoleKind;
}

/**
 * A SimplifyJobs listings.json source. Both the New-Grad and Internship repos
 * share the same JSON schema and path, so they're just two configs of this one
 * factory. The file is normally a top-level array; we also tolerate a
 * `{ listings: [...] }` wrapper in case the shape ever changes.
 */
export function simplifySource(cfg: SimplifyConfig): Source {
  return {
    key: cfg.key,
    label: cfg.label,
    roleKind: cfg.roleKind,
    async fetch(): Promise<RawListing[]> {
      const res = await fetch(cfg.url, {
        headers: { "User-Agent": "job-tracker-ingest/0.1" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${cfg.url}`);
      }
      const data: unknown = await res.json();
      if (Array.isArray(data)) return data as RawListing[];
      if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).listings)) {
        return (data as { listings: RawListing[] }).listings;
      }
      throw new Error(`Unexpected JSON shape from ${cfg.url}`);
    },
  };
}
