/**
 * Parity check for the location port (P0b).
 *
 * Run: `npm run check:location`
 *
 * For every fixture it asserts:
 *   1. TS classifyLocation() → expected { fit, relocation }
 *   2. TS evaluateScope()   → expected inScope (+ any required flag substrings)
 *   3. Cross-check vs the REAL Python find_jobs.classify_location(), which must
 *      agree except on fixtures explicitly marked `deviates` (the US remote/
 *      on-site split SPEC.md requires but Python doesn't make).
 *
 * Exits non-zero on any mismatch.
 */
import { execFileSync } from "node:child_process";
import { classifyLocation } from "../src/lib/location";
import { evaluateScope } from "../src/lib/scope";
import { LOCATION_FIT, type LocationFit } from "../src/lib/enums";

interface Fixture {
  name: string;
  locations: string[];
  terms?: string[];
  expect: {
    fit: LocationFit;
    relocation: boolean;
    inScope: boolean;
    flagIncludes?: string[];
  };
  /** TS intentionally differs from Python here (US remote/on-site split). */
  deviates?: boolean;
}

const F = LOCATION_FIT;

const FIXTURES: Fixture[] = [
  { name: "Vancouver metro", locations: ["Vancouver, BC"],
    expect: { fit: F.VANCOUVER, relocation: false, inScope: true } },
  { name: "Burnaby (BC + Canada, VAN wins)", locations: ["Burnaby, British Columbia, Canada"],
    expect: { fit: F.VANCOUVER, relocation: false, inScope: true } },
  { name: "Canada remote", locations: ["Remote, Canada"],
    expect: { fit: F.CANADA_REMOTE, relocation: false, inScope: true } },
  { name: "Toronto on-site (relocate)", locations: ["Toronto, ON"],
    expect: { fit: F.CANADA_OTHER, relocation: true, inScope: true } },
  { name: "Generic remote", locations: ["Remote"],
    expect: { fit: F.REMOTE_GENERIC, relocation: false, inScope: true, flagIncludes: ["Canada-eligible"] } },
  { name: "Remote India (unknown country → generic)", locations: ["Remote, India"],
    expect: { fit: F.REMOTE_GENERIC, relocation: false, inScope: true } },
  { name: "US remote (DEVIATION)", locations: ["Remote, USA"], deviates: true,
    expect: { fit: F.US_REMOTE, relocation: false, inScope: true, flagIncludes: ["work authorization"] } },
  { name: "US remote CA (DEVIATION)", locations: ["Remote, CA"], deviates: true,
    expect: { fit: F.US_REMOTE, relocation: false, inScope: true, flagIncludes: ["work authorization"] } },
  { name: "Mixed SF + Remote (DEVIATION)", locations: ["San Francisco, CA", "Remote"], deviates: true,
    expect: { fit: F.US_REMOTE, relocation: false, inScope: true } },
  { name: "Seattle on-site", locations: ["Seattle, WA"],
    expect: { fit: F.US_ONSITE, relocation: true, inScope: false, flagIncludes: ["visa"] } },
  { name: "New York on-site", locations: ["New York, NY"],
    expect: { fit: F.US_ONSITE, relocation: true, inScope: false } },
  { name: "London UK on-site", locations: ["London, UK"],
    expect: { fit: F.OTHER, relocation: true, inScope: false } },
  { name: "Richmond VA is US (DEVIATION)", locations: ["Richmond, VA"], deviates: true,
    expect: { fit: F.US_ONSITE, relocation: true, inScope: false } },
  { name: "Richmond BC is Vancouver", locations: ["Richmond, BC"],
    expect: { fit: F.VANCOUVER, relocation: false, inScope: true } },
  { name: "Vancouver WA is US (DEVIATION)", locations: ["Vancouver, WA"], deviates: true,
    expect: { fit: F.US_ONSITE, relocation: true, inScope: false } },
  { name: "Berlin contract (non-remote → out)", locations: ["Berlin, Germany"], terms: ["Contract"],
    expect: { fit: F.OTHER, relocation: true, inScope: false } },
  { name: "Ottawa + clearance flag", locations: ["Ottawa, ON"], terms: ["Security Clearance required"],
    expect: { fit: F.CANADA_OTHER, relocation: true, inScope: true, flagIncludes: ["PR/citizenship/clearance"] } },
  { name: "Empty locations", locations: [],
    expect: { fit: F.OTHER, relocation: true, inScope: false } },
];

// Python's 6 buckets → our fit values (for the non-deviating cases).
const PY_TO_TS: Record<string, LocationFit> = {
  vancouver: F.VANCOUVER,
  canada_remote: F.CANADA_REMOTE,
  canada_other: F.CANADA_OTHER,
  remote_generic: F.REMOTE_GENERIC,
  us: F.US_ONSITE,
  other: F.OTHER,
};

function pythonBuckets(locationLists: string[][]): Array<[string, boolean]> {
  const code = [
    "import sys, json",
    "sys.path.insert(0, 'scripts')",
    "import find_jobs as fj",
    "print(json.dumps([list(fj.classify_location(l)) for l in json.load(sys.stdin)]))",
  ].join("\n");
  const out = execFileSync("python3", ["-c", code], {
    input: JSON.stringify(locationLists),
    encoding: "utf-8",
  });
  return JSON.parse(out);
}

function main() {
  const py = pythonBuckets(FIXTURES.map((f) => f.locations));
  const failures: string[] = [];

  FIXTURES.forEach((f, i) => {
    const cls = classifyLocation(f.locations);
    const scope = evaluateScope({ fit: cls.fit, locations: f.locations, terms: f.terms });
    const [pyBucket, pyReloc] = py[i];
    const problems: string[] = [];

    if (cls.fit !== f.expect.fit) problems.push(`fit ${cls.fit} ≠ ${f.expect.fit}`);
    if (cls.relocation !== f.expect.relocation) problems.push(`relocation ${cls.relocation} ≠ ${f.expect.relocation}`);
    if (scope.inScope !== f.expect.inScope) problems.push(`inScope ${scope.inScope} ≠ ${f.expect.inScope}`);
    for (const needle of f.expect.flagIncludes ?? []) {
      if (!scope.authFlags.some((fl) => fl.includes(needle))) {
        problems.push(`missing flag ~"${needle}" (got ${JSON.stringify(scope.authFlags)})`);
      }
    }
    // Cross-check against Python except where we intentionally diverge.
    if (!f.deviates) {
      const mapped = PY_TO_TS[pyBucket];
      if (mapped !== cls.fit) problems.push(`python ${pyBucket}→${mapped} ≠ ts ${cls.fit}`);
      if (pyReloc !== cls.relocation) problems.push(`python relocate ${pyReloc} ≠ ts ${cls.relocation}`);
    }

    const tag = f.deviates ? "≠py" : " py";
    const mark = problems.length ? "✗" : "✓";
    console.log(
      `${mark} [${tag}] ${f.name.padEnd(34)} ts=${cls.fit.padEnd(14)} py=${pyBucket}`,
    );
    if (problems.length) failures.push(`${f.name}: ${problems.join("; ")}`);
  });

  console.log();
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`);
    failures.forEach((x) => console.error("  - " + x));
    process.exit(1);
  }
  console.log(`All ${FIXTURES.length} fixtures passed (TS ↔ Python parity, minus documented deviations).`);
}

main();
