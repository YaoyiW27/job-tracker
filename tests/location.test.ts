import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { classifyLocation, isTopTier } from "@/lib/location";
import { effectiveLocationRank } from "@/lib/scoring";
import { LOCATION_FIT, type LocationFit } from "@/lib/enums";

const F = LOCATION_FIT;

// [name, locations, expected fit, expected relocation, deviatesFromPython?]
const CASES: Array<[string, string[], LocationFit, boolean, boolean?]> = [
  ["Vancouver metro", ["Vancouver, BC"], F.VANCOUVER, false],
  ["BC + Canada → Vancouver wins", ["Burnaby, British Columbia, Canada"], F.VANCOUVER, false],
  ["Canada remote", ["Remote, Canada"], F.CANADA_REMOTE, false],
  ["Toronto on-site", ["Toronto, ON"], F.CANADA_OTHER, true],
  ["generic remote", ["Remote"], F.REMOTE_GENERIC, false],
  ["remote unknown country", ["Remote, India"], F.REMOTE_GENERIC, false],
  ["US remote", ["Remote, USA"], F.US_REMOTE, false, true],
  ["US remote CA", ["Remote, CA"], F.US_REMOTE, false, true],
  ["mixed SF + Remote", ["San Francisco, CA", "Remote"], F.US_REMOTE, false, true],
  ["Seattle on-site", ["Seattle, WA"], F.US_ONSITE, true],
  ["New York on-site", ["New York, NY"], F.US_ONSITE, true],
  ["London UK", ["London, UK"], F.OTHER, true],
  ["Berlin", ["Berlin, Germany"], F.OTHER, true],
  ["empty", [], F.OTHER, true],
  // Ambiguous city names — must disambiguate by state/province/country.
  ["Richmond VA is US, not Vancouver", ["Richmond, VA"], F.US_ONSITE, true, true],
  ["Richmond BC is Vancouver", ["Richmond, BC"], F.VANCOUVER, false],
  ["Vancouver WA is US", ["Vancouver, WA"], F.US_ONSITE, true, true],
  ["Surrey BC is Vancouver", ["Surrey, BC"], F.VANCOUVER, false],
  ["Surrey UK is other", ["Surrey, UK"], F.OTHER, true, true],
  ["London ON is Canada", ["London, ON"], F.CANADA_OTHER, true],
  ["Canada wins over US in multi-region", ["Toronto, ON", "Austin, TX"], F.CANADA_OTHER, true],
  ["bare Vancouver assumed BC", ["Vancouver"], F.VANCOUVER, false],
];

describe("classifyLocation", () => {
  it.each(CASES)("%s → fit + relocation", (_name, locs, fit, reloc) => {
    const r = classifyLocation(locs);
    expect(r.fit).toBe(fit);
    expect(r.relocation).toBe(reloc);
  });
});

describe("isTopTier", () => {
  it("matches known companies case-insensitively", () => {
    expect(isTopTier("Google")).toBe(true);
    expect(isTopTier("  OpenAI ")).toBe(true);
    expect(isTopTier("nvidia")).toBe(true);
  });
  it("rejects unknown companies", () => {
    expect(isTopTier("Some Small Startup")).toBe(false);
  });
});

describe("effectiveLocationRank (top-tier bump)", () => {
  it("bumps relocation tiers (rank >= 3) up one for top-tier", () => {
    expect(effectiveLocationRank(F.BC_OTHER, false)).toBe(3);
    expect(effectiveLocationRank(F.BC_OTHER, true)).toBe(2);
    expect(effectiveLocationRank(F.CANADA_OTHER, false)).toBe(4);
    expect(effectiveLocationRank(F.CANADA_OTHER, true)).toBe(3);
    expect(effectiveLocationRank(F.US_ONSITE, true)).toBe(5);
  });
  it("does not bump the top tiers (rank < 3)", () => {
    expect(effectiveLocationRank(F.VANCOUVER, true)).toBe(0);
    expect(effectiveLocationRank(F.CANADA_REMOTE, true)).toBe(1);
    expect(effectiveLocationRank(F.REMOTE_GENERIC, true)).toBe(2);
  });
});

// Parity vs the reference Python (scripts/find_jobs.py). Skipped if python3 is
// unavailable. Non-deviating cases must map to the same bucket; the US
// remote/on-site split is an intentional documented deviation.
function hasPython(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const PY_TO_TS: Record<string, LocationFit> = {
  vancouver: F.VANCOUVER,
  canada_remote: F.CANADA_REMOTE,
  canada_other: F.CANADA_OTHER,
  remote_generic: F.REMOTE_GENERIC,
  us: F.US_ONSITE,
  other: F.OTHER,
};

describe.skipIf(!hasPython())("parity vs find_jobs.py", () => {
  it("matches Python buckets except documented US-remote deviations", () => {
    const code = [
      "import sys, json",
      "sys.path.insert(0, 'scripts')",
      "import find_jobs as fj",
      "print(json.dumps([list(fj.classify_location(l)) for l in json.load(sys.stdin)]))",
    ].join("\n");
    const out = execFileSync("python3", ["-c", code], {
      input: JSON.stringify(CASES.map((c) => c[1])),
      encoding: "utf-8",
    });
    const py: Array<[string, boolean]> = JSON.parse(out);

    CASES.forEach(([name, locs, fit, reloc, deviates], i) => {
      if (deviates) return;
      const [pyBucket, pyReloc] = py[i];
      expect(PY_TO_TS[pyBucket], `${name}: python bucket ${pyBucket}`).toBe(fit);
      expect(pyReloc, `${name}: python relocation`).toBe(reloc);
    });
  });
});

describe("BC outside Metro Vancouver", () => {
  it("buckets the rest of the province as BC_OTHER, not CANADA_OTHER", () => {
    for (const loc of ["Victoria, BC, Canada", "Kelowna, BC", "Nanaimo, British Columbia"]) {
      expect(classifyLocation([loc]).fit, loc).toBe(F.BC_OTHER);
    }
  });
  it("recognizes distinctive BC city names with no province signal", () => {
    for (const loc of ["Kamloops", "Prince George", "Abbotsford", "Whistler"]) {
      expect(classifyLocation([loc]).fit, loc).toBe(F.BC_OTHER);
    }
  });
  it("does not claim same-named cities elsewhere", () => {
    expect(classifyLocation(["Victoria, TX"]).fit).toBe(F.US_ONSITE);
  });
  it("treats a BC role as requiring relocation", () => {
    expect(classifyLocation(["Victoria, BC"]).relocation).toBe(true);
  });
  it("prefers remote over an in-province move", () => {
    expect(classifyLocation(["Remote — BC, Canada"]).fit).toBe(F.CANADA_REMOTE);
  });
  it("ranks an in-province move above a cross-country one", () => {
    const bc = classifyLocation(["Victoria, BC"]).fit;
    const toronto = classifyLocation(["Toronto, ON, Canada"]).fit;
    expect(effectiveLocationRank(bc, false)).toBeLessThan(effectiveLocationRank(toronto, false));
  });
});

describe("Metro Vancouver coverage", () => {
  it("includes the municipalities that were previously missing", () => {
    for (const loc of ["Maple Ridge, BC", "Pitt Meadows, BC", "White Rock, BC"]) {
      expect(classifyLocation([loc]).fit, loc).toBe(F.VANCOUVER);
    }
  });
  it("still needs a BC signal for the ambiguous ones", () => {
    expect(classifyLocation(["White Rock, NM"]).fit).toBe(F.US_ONSITE);
  });
  it("treats metro Vancouver as no relocation", () => {
    expect(classifyLocation(["Maple Ridge, BC"]).relocation).toBe(false);
  });
});
