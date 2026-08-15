import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildScoreMessages,
  buildScoreSchema,
  normalizeScoreResult,
  type JobMeta,
  type ResumeVariant,
} from "../src/lib/scorer/prompt";
import { discoverResumeVariants } from "../src/lib/scorer/variants";

function fixtureDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "resumes-"));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body, "utf-8");
  }
  return dir;
}

const JOB: JobMeta = {
  company: "Clio",
  title: "Systems Engineer, Production",
  locations: ["Vancouver, BC"],
  terms: [],
  locationFit: "local",
  salary: "CAD 119k-161k",
};

const VARIANTS: ResumeVariant[] = [
  { id: "AIops", label: "infra / platform / DevOps / SRE", text: "Terraform, Kubernetes, Nginx" },
  { id: "AIeng", label: "AI engineer / LLM product", text: "LangGraph, Claude API" },
];

describe("discoverResumeVariants", () => {
  it("picks up every .tex and ignores everything else", () => {
    const dir = fixtureDir({
      "YaoyiWang_Resume_AIops.tex": "\\textbf{Ops}",
      "YaoyiWang_Resume_AIeng.tex": "\\textbf{Eng}",
      "preferences.md": "not a resume",
    });
    expect(discoverResumeVariants(dir).map((v) => v.id)).toEqual(["AIeng", "AIops"]);
  });

  it("reads its label from a '% variant:' comment, so a new resume needs no code change", () => {
    const dir = fixtureDir({
      "YaoyiWang_Resume_AIops.tex": "% variant: infra / platform / DevOps / SRE\n\\textbf{Body}",
    });
    expect(discoverResumeVariants(dir)[0].label).toBe("infra / platform / DevOps / SRE");
  });

  it("falls back to the id when the label comment is missing", () => {
    const dir = fixtureDir({ "YaoyiWang_Resume_AIinfra.tex": "\\textbf{Body}" });
    expect(discoverResumeVariants(dir)[0].label).toBe("AIinfra");
  });

  it("strips LaTeX so the model is handed prose, not macros", () => {
    const dir = fixtureDir({
      "R_AIops.tex": "% variant: ops\n\\textbf{Terraform} and \\textit{Kubernetes}",
    });
    const { text } = discoverResumeVariants(dir)[0];
    expect(text).toContain("Terraform");
    expect(text).toContain("Kubernetes");
    expect(text).not.toContain("\\textbf");
  });
});

describe("buildScoreSchema", () => {
  it("constrains betterResume to the discovered variants plus 'either'", () => {
    const schema = buildScoreSchema(["AIops", "AIeng", "AIinfra"]);
    expect(schema.properties.betterResume.enum).toEqual(["AIops", "AIeng", "AIinfra", "either"]);
  });
});

describe("buildScoreMessages", () => {
  it("shows the model every variant, by id and label", () => {
    const { user, system } = buildScoreMessages(JOB, "prefs", VARIANTS);
    for (const v of VARIANTS) {
      expect(user).toContain(v.id);
      expect(user).toContain(v.label);
      expect(user).toContain(v.text);
      expect(system).toContain(v.id);
    }
  });

  it("tells the model to infer conservatively when it only has metadata", () => {
    const { system } = buildScoreMessages(JOB, "prefs", VARIANTS);
    expect(system).toMatch(/metadata only/i);
  });

  it("passes a full description through and drops the metadata-only caveat", () => {
    const job = { ...JOB, description: "Terraform at scale, EKS in production, Buildkite" };
    const { user, system } = buildScoreMessages(job, "prefs", VARIANTS);
    expect(user).toContain("EKS in production");
    expect(system).not.toMatch(/metadata only/i);
  });
});

describe("normalizeScoreResult", () => {
  const ids = ["AIops", "AIeng"];

  it("keeps a variant the model actually chose", () => {
    const r = normalizeScoreResult({ betterResume: "AIeng" }, ids);
    expect(r.betterResume).toBe("AIeng");
  });

  it("falls back to 'either' when the model invents a variant", () => {
    // Guards the one thing a JSON schema cannot: a hallucinated enum value
    // arriving through a non-structured path or a loosened schema.
    expect(normalizeScoreResult({ betterResume: "AIquantum" }, ids).betterResume).toBe("either");
  });

  it("clamps and rounds the score", () => {
    expect(normalizeScoreResult({ fitScore: 150 }, ids).fitScore).toBe(100);
    expect(normalizeScoreResult({ fitScore: -10 }, ids).fitScore).toBe(0);
    expect(normalizeScoreResult({ fitScore: 87.6 }, ids).fitScore).toBe(88);
    expect(normalizeScoreResult({ fitScore: "abc" }, ids).fitScore).toBe(0);
  });
});


describe("metadata placeholders vs a real description", () => {
  const bare = { ...JOB, locations: [], salary: null, locationFit: "unknown" };

  it("keeps 'not listed' on the ingest path, where metadata is all there is", () => {
    const { user } = buildScoreMessages(bare, "prefs", VARIANTS);
    expect(user).toContain("Salary: not listed");
  });

  it("omits absent fields when a description is present, instead of asserting they are missing", () => {
    // Salary and location are two of the four scoring weights — telling the
    // model they are "not listed" when the description states them would score
    // the job down for the form being short, not for the job being worse.
    const { user } = buildScoreMessages(
      { ...bare, description: "word ".repeat(60) + "Pays CAD 119k-161k in Vancouver." },
      "prefs",
      VARIANTS,
    );
    expect(user).not.toContain("not listed");
    expect(user).not.toContain("Locations: —");
    expect(user).toContain("read it from the description");
  });
});

describe("company and role extraction", () => {
  it("omits the metadata lines entirely when only a description is pasted", () => {
    // Printing "Company: unknown" would assert an absence the description
    // usually contradicts — LinkedIn keeps the company in the page header, so a
    // body-only paste really can lack it, and we want that visible, not asserted.
    const { user } = buildScoreMessages(
      { locations: [], terms: [], locationFit: "unknown", salary: null, description: "word ".repeat(60) },
      "prefs",
      VARIANTS,
    );
    expect(user).not.toContain("Company: unknown");
    expect(user).not.toContain("Title: unknown");
  });

  it("echoes back what the model read, so a bad paste is visible in the result", () => {
    const r = normalizeScoreResult({ company: "Clio", title: "Systems Engineer" }, ["AIops"]);
    expect(r.company).toBe("Clio");
    expect(r.title).toBe("Systems Engineer");
  });

  it("falls back to 'unknown' rather than an empty label", () => {
    const r = normalizeScoreResult({}, ["AIops"]);
    expect(r.company).toBe("unknown");
  });
});
