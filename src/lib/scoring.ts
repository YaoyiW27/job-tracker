import { LOCATION_RANK, type LocationFit } from "./enums";

/**
 * Effective sort rank for a job's location.
 *
 * Ported from find_jobs.py sort_key(): a top-tier company jumps ONE bucket up,
 * but only from the relocation tiers (rank >= 3) — those are the ones worth
 * relocating for. Lower rank = better. Used by Discover to order results.
 */
export function effectiveLocationRank(
  fit: LocationFit,
  topTier: boolean,
): number {
  let rank = LOCATION_RANK[fit];
  if (topTier && rank >= 3) {
    rank -= 1;
  }
  return rank;
}
