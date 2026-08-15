import { describe, it, expect } from "vitest";
import { stripLatex } from "@/lib/scorer/latex";
import {
  buildScoreMessages,
  normalizeScoreResult,
  formatFitReason,
  isScoringEnabled,
} from "@/lib/scorer/prompt";

describe("stripLatex", () => {
  it("drops comment lines", () => {
    expect(stripLatex("Hello % a comment\nWorld")).not.toContain("comment");
  });
  it("unwraps text-formatting macros", () => {
    expect(stripLatex("\\textbf{Yaoyi} \\textit{Wang}")).toBe("Yaoyi Wang");
  });
  it("keeps the visible text of \\href", () => {
    expect(stripLatex("\\href{https://x.com}{GitHub}")).toBe("GitHub");
  });
  it("turns \\section into its title and \\item into a bullet", () => {
    const out = stripLatex("\\section{Experience}\n\\item Built stuff");
    expect(out).toContain("Experience");
    expect(out).toContain("- Built stuff");
  });
  it("unescapes specials and drops leftover braces", () => {
    expect(stripLatex("R\\&D {group}")).toBe("R&D group");
  });
});

describe("buildScoreMessages", () => {
  const job = {
    company: "Acme",
    title: "ML Infrastructure Engineer",
    locations: ["Vancouver, BC"],
    terms: ["Full-time"],
    locationFit: "VANCOUVER",
    salary: null,
  };
  const msgs = buildScoreMessages(job, "PREFS: high AI acceptance", [
    { id: "AIops", label: "infra / platform", text: "RESUME_A_INFRA" },
    { id: "AIinfra", label: "ML infra", text: "RESUME_B_MLINFRA" },
  ]);

  it("scores 0-100, weights AI, and forbids unbacked skills in the system prompt", () => {
    expect(msgs.system).toMatch(/0\D*100|0-100|0–100/);
    expect(msgs.system).toContain("AI");
    expect(msgs.system.toLowerCase()).toContain("no evidence");
    expect(msgs.system).toContain("AIops");
    expect(msgs.system).toContain("AIinfra");
  });

  it("includes the job metadata, preferences, and both resumes in the user message", () => {
    expect(msgs.user).toContain("Acme");
    expect(msgs.user).toContain("ML Infrastructure Engineer");
    expect(msgs.user).toContain("Vancouver, BC");
    expect(msgs.user).toContain("high AI acceptance");
    expect(msgs.user).toContain("RESUME_A_INFRA");
    expect(msgs.user).toContain("RESUME_B_MLINFRA");
  });
});

const IDS = ["AIops", "AIinfra"];

describe("normalizeScoreResult", () => {
  it("clamps and rounds the score", () => {
    expect(normalizeScoreResult({ fitScore: 150 }, IDS).fitScore).toBe(100);
    expect(normalizeScoreResult({ fitScore: -10 }, IDS).fitScore).toBe(0);
    expect(normalizeScoreResult({ fitScore: 87.6 }, IDS).fitScore).toBe(88);
  });
  it("defaults an invalid score to 0", () => {
    expect(normalizeScoreResult({ fitScore: "abc" }, IDS).fitScore).toBe(0);
    expect(normalizeScoreResult({}, IDS).fitScore).toBe(0);
  });
  it("validates betterResume against the discovered variant ids", () => {
    expect(normalizeScoreResult({ betterResume: "AIops" }, IDS).betterResume).toBe("AIops");
    expect(normalizeScoreResult({ betterResume: "AIinfra" }, IDS).betterResume).toBe("AIinfra");
    expect(normalizeScoreResult({ betterResume: "AIquantum" }, IDS).betterResume).toBe("either");
  });
  it("trims reason strings", () => {
    expect(normalizeScoreResult({ fitReason: "  strong AI culture  " }, IDS).fitReason).toBe("strong AI culture");
  });
});

describe("formatFitReason", () => {
  it("appends the resume pick when A or B", () => {
    const out = formatFitReason({ company: "Clio", title: "SysEng", fitScore: 90, fitReason: "AI-forward", betterResume: "AIinfra", resumeReason: "LLM serving match" });
    expect(out).toContain("AI-forward");
    expect(out).toContain("Resume AIinfra");
    expect(out).toContain("LLM serving match");
  });
  it("omits the resume clause when either", () => {
    const out = formatFitReason({ company: "Clio", title: "SysEng", fitScore: 50, fitReason: "just a reason", betterResume: "either", resumeReason: "" });
    expect(out).toBe("just a reason");
  });
});

describe("isScoringEnabled", () => {
  it("is true only when ANTHROPIC_API_KEY is set", () => {
    expect(isScoringEnabled({ ANTHROPIC_API_KEY: "sk-x" })).toBe(true);
    expect(isScoringEnabled({ ANTHROPIC_API_KEY: "  " })).toBe(false);
    expect(isScoringEnabled({})).toBe(false);
  });
});
