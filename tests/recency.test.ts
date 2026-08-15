import { describe, it, expect } from "vitest";
import { recencyTier } from "@/lib/recency";

const NOW = Date.parse("2026-08-14T12:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

describe("recencyTier", () => {
  it("buckets by age relative to now", () => {
    expect(recencyTier(ago(12), NOW).tier).toBe("<24h");
    expect(recencyTier(ago(48), NOW).tier).toBe("<3d");
    expect(recencyTier(ago(24 * 5), NOW).tier).toBe("<1w");
    expect(recencyTier(ago(24 * 10), NOW).tier).toBe("<2w");
    expect(recencyTier(ago(24 * 30), NOW).tier).toBe("older");
  });

  it("ranks fresher tiers lower (sort-ascending friendly)", () => {
    expect(recencyTier(ago(1), NOW).rank).toBeLessThan(recencyTier(ago(24 * 30), NOW).rank);
    expect(recencyTier(ago(1), NOW).rank).toBe(0);
  });

  it("handles null and invalid dates as unknown", () => {
    expect(recencyTier(null, NOW)).toEqual({ tier: "—", rank: 99 });
    expect(recencyTier("not-a-date", NOW)).toEqual({ tier: "—", rank: 99 });
  });

  it("accepts Date objects and ISO strings", () => {
    expect(recencyTier(new Date(NOW - 3_600_000), NOW).tier).toBe("<24h");
    expect(recencyTier(ago(2), NOW).tier).toBe("<24h");
  });
});
