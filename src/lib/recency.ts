// Freshness tier from a posting date — a SEPARATE ranking signal from fitScore.
// Lower rank = fresher (sort-ascending friendly). Pure; unit-tested.

export type RecencyTier = "<24h" | "<3d" | "<1w" | "<2w" | "older" | "—";

const DAY_MS = 86_400_000;

export function recencyTier(
  datePosted: string | Date | null | undefined,
  now: number = Date.now(),
): { tier: RecencyTier; rank: number } {
  if (!datePosted) return { tier: "—", rank: 99 };
  const t = datePosted instanceof Date ? datePosted.getTime() : new Date(datePosted).getTime();
  if (Number.isNaN(t)) return { tier: "—", rank: 99 };
  const days = (now - t) / DAY_MS;
  if (days < 1) return { tier: "<24h", rank: 0 };
  if (days < 3) return { tier: "<3d", rank: 1 };
  if (days < 7) return { tier: "<1w", rank: 2 };
  if (days < 14) return { tier: "<2w", rank: 3 };
  return { tier: "older", rank: 4 };
}
