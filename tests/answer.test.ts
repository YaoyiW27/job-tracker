import { describe, it, expect } from "vitest";
import {
  ANSWER_SCHEMA,
  buildAnswerMessages,
  countWords,
  defaultQuestion,
  draftAnswer,
  normalizeAnswer,
} from "@/lib/answer";

const CTX = {
  preferences: "AI-forward teams, build-heavy work, avoid ticket queues.",
  style: "Short declarative sentences. No enthusiasm words.",
  variant: { id: "AIops", label: "infra / platform", text: "Terraform, Kubernetes, GitHub Actions" },
};

const JD = "CrowdStrike — Sandbox Agentic Engineer (Remote, Canada). Build agent sandboxes on Kubernetes.";

describe("defaultQuestion", () => {
  it("falls back to the question these forms actually ask", () => {
    expect(defaultQuestion("", "CrowdStrike")).toMatch(/CrowdStrike/);
  });
  it("keeps the question the user pasted from the form", () => {
    expect(defaultQuestion("What interests you about this role?", "X")).toBe(
      "What interests you about this role?",
    );
  });
  it("stays generic when the company is unknown", () => {
    expect(defaultQuestion("", "")).toMatch(/company|role/i);
  });
});

describe("buildAnswerMessages", () => {
  const { system, user } = buildAnswerMessages(
    { question: "Why do you want to work here?", description: JD, company: "CrowdStrike" },
    CTX,
  );

  it("puts the posting and the question in the user turn", () => {
    expect(user).toContain("Sandbox Agentic Engineer");
    expect(user).toContain("Why do you want to work here?");
  });

  it("carries my style rules and the chosen résumé into the system turn", () => {
    expect(system).toContain("No enthusiasm words");
    expect(system).toContain("Terraform");
  });

  it("forbids inventing interest or experience", () => {
    expect(system).toMatch(/do not invent|never invent/i);
  });

  it("asks for a form-field answer, not a cover letter", () => {
    expect(system).toMatch(/sentence/i);
  });
});

describe("normalizeAnswer", () => {
  const full = {
    answer: "  I build platform tooling.  ",
    fromPosting: [" agent sandboxes on Kubernetes ", ""],
    fromResume: ["Terraform"],
    gaps: [],
  };

  it("trims and drops empty evidence entries", () => {
    const r = normalizeAnswer(full);
    expect(r.answer).toBe("I build platform tooling.");
    expect(r.fromPosting).toEqual(["agent sandboxes on Kubernetes"]);
  });

  it("reports the word count so an over-long draft is obvious", () => {
    expect(normalizeAnswer({ answer: "one two three" }).wordCount).toBe(3);
  });

  it("survives missing fields rather than throwing", () => {
    expect(normalizeAnswer({})).toEqual({
      answer: "",
      fromPosting: [],
      fromResume: [],
      gaps: [],
      wordCount: 0,
    });
    expect(normalizeAnswer(null).answer).toBe("");
  });

  it("keeps gaps — what the question asks for and the material can't support", () => {
    expect(normalizeAnswer({ answer: "x", gaps: ["no security experience"] }).gaps).toEqual([
      "no security experience",
    ]);
  });
});

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  a  b\nc ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("ANSWER_SCHEMA", () => {
  it("requires the evidence lists, so grounding can't be silently skipped", () => {
    expect(ANSWER_SCHEMA.required).toEqual(
      expect.arrayContaining(["answer", "fromPosting", "fromResume"]),
    );
  });
});

describe("draftAnswer", () => {
  const reply = (text: string, stop = "end_turn") => ({
    stop_reason: stop,
    content: [{ type: "text", text }],
  });
  const req = { question: "Why here?", description: JD, company: "CrowdStrike" };

  it("returns the normalized draft", async () => {
    const client = {
      messages: {
        create: async () =>
          reply(
            JSON.stringify({
              answer: "I build platform tooling.",
              fromPosting: ["agent sandboxes"],
              fromResume: ["Terraform"],
              gaps: [],
            }),
          ),
      },
    };
    const r = await draftAnswer(req, CTX, client as never);
    expect(r?.answer).toBe("I build platform tooling.");
    expect(r?.wordCount).toBe(4);
  });

  it("returns null on refusal, an API error, or unparseable output", async () => {
    const refusal = { messages: { create: async () => reply("{}", "refusal") } };
    const junk = { messages: { create: async () => reply("sorry") } };
    const boom = {
      messages: {
        create: async () => {
          throw new Error("rate limited");
        },
      },
    };
    expect(await draftAnswer(req, CTX, refusal as never)).toBeNull();
    expect(await draftAnswer(req, CTX, junk as never)).toBeNull();
    expect(await draftAnswer(req, CTX, boom as never)).toBeNull();
  });
});
