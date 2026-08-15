import { describe, it, expect } from "vitest";
import { FILTER_STATUSES, countByStatus, filterByStatus } from "@/lib/status-filter";

const rows = [
  { status: "SAVED" },
  { status: "SAVED" },
  { status: "APPLIED" },
  { status: "OA" },
  { status: "REJECTED" },
  { status: "GHOSTED" },
];

describe("FILTER_STATUSES", () => {
  it("offers the states worth jumping to, in pipeline order", () => {
    expect(FILTER_STATUSES).toEqual(["SAVED", "APPLIED", "OA", "INTERVIEW", "OFFER"]);
  });

  it("leaves out the dead ends — they are history, not a working set", () => {
    expect(FILTER_STATUSES).not.toContain("REJECTED");
    expect(FILTER_STATUSES).not.toContain("GHOSTED");
  });
});

describe("countByStatus", () => {
  it("counts each status", () => {
    const c = countByStatus(rows);
    expect(c.SAVED).toBe(2);
    expect(c.APPLIED).toBe(1);
    expect(c.OA).toBe(1);
  });

  it("reports zero for a status with no rows, so the chip still renders", () => {
    expect(countByStatus(rows).INTERVIEW).toBe(0);
    expect(countByStatus([]).SAVED).toBe(0);
  });

  it("still counts the statuses that have no chip", () => {
    // They are not filterable, but they are part of the total.
    expect(countByStatus(rows).REJECTED).toBe(1);
  });
});

describe("filterByStatus", () => {
  it("returns everything when no status is selected", () => {
    expect(filterByStatus(rows, null)).toHaveLength(6);
  });

  it("keeps only the selected status", () => {
    expect(filterByStatus(rows, "SAVED")).toHaveLength(2);
  });

  it("includes rejected and ghosted in the unfiltered view", () => {
    // Not filterable is not the same as hidden — an archived row is still yours.
    expect(filterByStatus(rows, null).map((r) => r.status)).toContain("REJECTED");
  });

  it("returns an empty list rather than everything for a status with no rows", () => {
    expect(filterByStatus(rows, "OFFER")).toEqual([]);
  });
});
