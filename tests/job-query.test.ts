import { describe, it, expect } from "vitest";
import { parseJobQuery, buildJobWhere, buildJobOrderBy } from "@/lib/job-query";

function q(s: string) {
  return parseJobQuery(new URLSearchParams(s));
}

describe("parseJobQuery", () => {
  it("applies defaults", () => {
    expect(q("")).toEqual({
      bucket: null,
      company: null,
      category: null,
      roleKind: null,
      minFitScore: null,
      activeOnly: true,
      inScopeOnly: false,
      sort: "fit",
      page: 1,
      pageSize: 50,
    });
  });

  it("parses the sort mode (default fit, else newest)", () => {
    expect(q("").sort).toBe("fit");
    expect(q("sort=newest").sort).toBe("newest");
    expect(q("sort=bogus").sort).toBe("fit");
  });

  it("reads and validates a known bucket + role", () => {
    const r = q("bucket=VANCOUVER&role=INTERN");
    expect(r.bucket).toBe("VANCOUVER");
    expect(r.roleKind).toBe("INTERN");
  });

  it("ignores invalid bucket / role values", () => {
    const r = q("bucket=MARS&role=CONTRACTOR");
    expect(r.bucket).toBeNull();
    expect(r.roleKind).toBeNull();
  });

  it("clamps minFitScore to 0..100 and ignores non-numbers", () => {
    expect(q("minFit=75").minFitScore).toBe(75);
    expect(q("minFit=250").minFitScore).toBe(100);
    expect(q("minFit=-5").minFitScore).toBe(0);
    expect(q("minFit=abc").minFitScore).toBeNull();
  });

  it("clamps page and pageSize", () => {
    expect(q("page=0").page).toBe(1);
    expect(q("pageSize=1000").pageSize).toBe(200);
    expect(q("pageSize=0").pageSize).toBe(1);
  });

  it("turns off activeOnly when active=all", () => {
    expect(q("active=all").activeOnly).toBe(false);
    expect(q("active=0").activeOnly).toBe(false);
    expect(q("").activeOnly).toBe(true);
  });

  it("enables inScopeOnly on truthy flag", () => {
    expect(q("inScope=1").inScopeOnly).toBe(true);
    expect(q("inScope=true").inScopeOnly).toBe(true);
    expect(q("").inScopeOnly).toBe(false);
  });

  it("trims company/category and drops empties", () => {
    expect(q("company=%20Stripe%20").company).toBe("Stripe");
    expect(q("company=%20%20").company).toBeNull();
  });
});

describe("buildJobWhere", () => {
  it("defaults to active + visible only", () => {
    expect(buildJobWhere(q(""))).toEqual({ active: true, isVisible: true });
  });

  it("drops active/visible constraints when activeOnly is false", () => {
    expect(buildJobWhere(q("active=all"))).toEqual({});
  });

  it("composes all filters", () => {
    const where = buildJobWhere(q("bucket=US_REMOTE&role=NEW_GRAD&company=stripe&category=SWE&minFit=80&inScope=1"));
    expect(where).toEqual({
      active: true,
      isVisible: true,
      inScope: true,
      locationFit: "US_REMOTE",
      roleKind: "NEW_GRAD",
      company: { contains: "stripe" },
      category: { contains: "SWE" },
      fitScore: { gte: 80 },
    });
  });
});

describe("buildJobOrderBy", () => {
  it("by fit: locationRank, then fitScore, then recency", () => {
    expect(buildJobOrderBy("fit")).toEqual([
      { locationRank: "asc" },
      { fitScore: "desc" },
      { datePosted: "desc" },
    ]);
  });
  it("defaults to fit", () => {
    expect(buildJobOrderBy()).toEqual(buildJobOrderBy("fit"));
  });
  it("by newest: datePosted first, then locationRank", () => {
    expect(buildJobOrderBy("newest")).toEqual([
      { datePosted: "desc" },
      { locationRank: "asc" },
    ]);
  });
});
