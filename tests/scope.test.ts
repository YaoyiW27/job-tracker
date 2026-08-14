import { describe, it, expect } from "vitest";
import { evaluateScope, isContractRemote } from "@/lib/scope";
import { LOCATION_FIT } from "@/lib/enums";

const F = LOCATION_FIT;

describe("evaluateScope — in-scope gate", () => {
  it("keeps NA + generic-remote buckets in scope", () => {
    for (const fit of [F.VANCOUVER, F.CANADA_REMOTE, F.REMOTE_GENERIC, F.CANADA_OTHER, F.US_REMOTE]) {
      expect(evaluateScope({ fit, locations: [] }).inScope, fit).toBe(true);
    }
  });
  it("marks US on-site out of scope (needs a visa)", () => {
    expect(evaluateScope({ fit: F.US_ONSITE, locations: ["Seattle, WA"] }).inScope).toBe(false);
  });
  it("marks non-remote foreign roles out of scope", () => {
    expect(evaluateScope({ fit: F.OTHER, locations: ["Berlin, Germany"] }).inScope).toBe(false);
  });
  it("keeps foreign roles that are remote + contract", () => {
    const r = evaluateScope({
      fit: F.OTHER,
      locations: ["Remote, Anywhere"],
      terms: ["Contract"],
    });
    expect(r.inScope).toBe(true);
  });
});

describe("evaluateScope — auth flags", () => {
  it("flags generic remote as verify-Canada-eligible", () => {
    const f = evaluateScope({ fit: F.REMOTE_GENERIC, locations: ["Remote"] }).authFlags;
    expect(f.some((x) => x.includes("Canada-eligible"))).toBe(true);
  });
  it("flags US remote for work authorization", () => {
    const f = evaluateScope({ fit: F.US_REMOTE, locations: ["Remote, USA"] }).authFlags;
    expect(f.some((x) => x.includes("work authorization"))).toBe(true);
  });
  it("flags US on-site as needing a visa", () => {
    const f = evaluateScope({ fit: F.US_ONSITE, locations: ["Seattle, WA"] }).authFlags;
    expect(f.some((x) => x.includes("visa"))).toBe(true);
  });
  it("flags Canadian roles that mention clearance/PR/citizenship", () => {
    const f = evaluateScope({
      fit: F.CANADA_OTHER,
      locations: ["Ottawa, ON"],
      terms: ["Security Clearance required"],
    }).authFlags;
    expect(f.some((x) => x.includes("PR/citizenship/clearance"))).toBe(true);
  });
  it("leaves clean Vancouver roles unflagged", () => {
    expect(evaluateScope({ fit: F.VANCOUVER, locations: ["Vancouver, BC"] }).authFlags).toEqual([]);
  });
});

describe("isContractRemote", () => {
  it("is true only when remote AND contract/freelance/part-time", () => {
    expect(isContractRemote(["Remote"], ["Contract"])).toBe(true);
    expect(isContractRemote(["Remote"], ["Freelance"])).toBe(true);
    expect(isContractRemote(["Remote"], undefined, "Part-time Engineer")).toBe(true);
  });
  it("is false when only one condition holds", () => {
    expect(isContractRemote(["Remote"], ["Full-time"])).toBe(false);
    expect(isContractRemote(["Toronto, ON"], ["Contract"])).toBe(false);
  });
});
