import { describe, it, expect } from "vitest";
import { computeDashboardMetrics } from "@/lib/dashboard";

const apps = [
  { status: "SAVED", company: "Acme", appliedDate: null },
  { status: "SAVED", company: "Globex", appliedDate: null },
  { status: "APPLIED", company: "Acme", appliedDate: "2026-08-01" },
  { status: "APPLIED", company: "Acme", appliedDate: "2026-08-01" },
  { status: "APPLIED", company: "Initech", appliedDate: "2026-08-02" },
  { status: "OA", company: "Globex", appliedDate: "2026-08-02" },
  { status: "INTERVIEW", company: "Acme", appliedDate: "2026-08-03" },
  { status: "OFFER", company: "Umbrella", appliedDate: "2026-08-03" },
  { status: "REJECTED", company: "Globex", appliedDate: "2026-08-03" },
  { status: "GHOSTED", company: "Initech", appliedDate: null },
];

describe("computeDashboardMetrics", () => {
  const m = computeDashboardMetrics(apps);

  it("counts totals and applied (non-SAVED)", () => {
    expect(m.total).toBe(10);
    expect(m.applied).toBe(8);
  });

  it("counts in-progress (APPLIED/OA/INTERVIEW only)", () => {
    expect(m.inProgress).toBe(5);
  });

  it("counts offers", () => {
    expect(m.offers).toBe(1);
  });

  it("computes response rate = responded / applied", () => {
    // responded = OA+INTERVIEW+OFFER+REJECTED = 4; applied = 8
    expect(m.responded).toBe(4);
    expect(m.responseRate).toBeCloseTo(0.5, 5);
  });

  it("returns 0 response rate when nothing applied", () => {
    const z = computeDashboardMetrics([{ status: "SAVED", company: "X", appliedDate: null }]);
    expect(z.responseRate).toBe(0);
  });

  it("buckets counts by status in pipeline order, including zeros", () => {
    expect(m.byStatus).toEqual([
      { status: "SAVED", count: 2 },
      { status: "APPLIED", count: 3 },
      { status: "OA", count: 1 },
      { status: "INTERVIEW", count: 1 },
      { status: "OFFER", count: 1 },
      { status: "REJECTED", count: 1 },
      { status: "GHOSTED", count: 1 },
    ]);
  });

  it("aggregates applications over time by applied date, sorted, ignoring null dates", () => {
    expect(m.overTime).toEqual([
      { date: "2026-08-01", count: 2 },
      { date: "2026-08-02", count: 2 },
      { date: "2026-08-03", count: 3 },
    ]);
  });

  it("ranks top companies by count, descending", () => {
    expect(m.topCompanies[0]).toEqual({ company: "Acme", count: 4 });
    expect(m.topCompanies.map((c) => c.company)).toEqual(["Acme", "Globex", "Initech", "Umbrella"]);
  });
});
