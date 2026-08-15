import { describe, it, expect } from "vitest";
import { STATUS_ORDER, groupByStatus, movePatch, statusRank, showsDetail } from "@/lib/kanban";

const apps = [
  { id: "1", status: "SAVED" },
  { id: "2", status: "APPLIED" },
  { id: "3", status: "SAVED" },
  { id: "4", status: "OFFER" },
];

describe("STATUS_ORDER", () => {
  it("lists all seven statuses in pipeline order", () => {
    expect(STATUS_ORDER).toEqual([
      "SAVED",
      "APPLIED",
      "OA",
      "INTERVIEW",
      "OFFER",
      "REJECTED",
      "GHOSTED",
    ]);
  });
});

describe("groupByStatus", () => {
  it("returns every status column, even empty ones", () => {
    const g = groupByStatus(apps);
    expect(Object.keys(g).sort()).toEqual([...STATUS_ORDER].sort());
    expect(g.OA).toEqual([]);
    expect(g.INTERVIEW).toEqual([]);
  });

  it("buckets cards under their status, preserving input order", () => {
    const g = groupByStatus(apps);
    expect(g.SAVED.map((a) => a.id)).toEqual(["1", "3"]);
    expect(g.APPLIED.map((a) => a.id)).toEqual(["2"]);
    expect(g.OFFER.map((a) => a.id)).toEqual(["4"]);
  });
});

describe("movePatch", () => {
  const TODAY = "2026-08-14";

  it("returns a status patch when moving to a different column", () => {
    expect(movePatch({ status: "SAVED", appliedDate: "2026-07-01" }, "INTERVIEW", TODAY)).toEqual({
      status: "INTERVIEW",
    });
  });
  it("returns null when dropped in the same column", () => {
    expect(movePatch({ status: "APPLIED", appliedDate: null }, "APPLIED", TODAY)).toBeNull();
  });
  it("stamps today when dragging an undated card out of SAVED", () => {
    expect(movePatch({ status: "SAVED", appliedDate: null }, "APPLIED", TODAY)).toEqual({
      status: "APPLIED",
      appliedDate: TODAY,
    });
  });
  it("does not stamp when dragging back to SAVED", () => {
    expect(movePatch({ status: "OA", appliedDate: null }, "SAVED", TODAY)).toEqual({
      status: "SAVED",
    });
  });
});

describe("statusRank", () => {
  it("orders by pipeline position, not alphabetically", () => {
    // Alphabetically APPLIED < GHOSTED < INTERVIEW < OA < OFFER — sorting the
    // Status column that way tells you nothing about where things stand.
    const sorted = ["OFFER", "SAVED", "INTERVIEW", "APPLIED"].sort(
      (a, b) => statusRank(a) - statusRank(b),
    );
    expect(sorted).toEqual(["SAVED", "APPLIED", "INTERVIEW", "OFFER"]);
  });
  it("puts an unknown status last rather than first", () => {
    expect(statusRank("NONSENSE")).toBeGreaterThan(statusRank("GHOSTED"));
  });
});

describe("showsDetail", () => {
  it("keeps the detail for the columns worth reading one by one", () => {
    for (const s of ["OA", "INTERVIEW", "OFFER"]) {
      expect(showsDetail(s), s).toBe(true);
    }
  });
  it("collapses the ones that grow to hundreds", () => {
    // Saved and applied become a pile; rejected and ghosted are history.
    for (const s of ["SAVED", "APPLIED", "REJECTED", "GHOSTED"]) {
      expect(showsDetail(s), s).toBe(false);
    }
  });
});
