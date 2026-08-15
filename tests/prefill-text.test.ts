import { describe, it, expect, afterEach } from "vitest";
import {
  MAX_PASTE_CHARS,
  clampPaste,
  buildExtractMessages,
  normalizeExtract,
  isExtractionEnabled,
  extractFromText,
} from "@/lib/prefill-text";

const JD = [
  "Senior Site Reliability Engineer",
  "IBM · Vancouver, BC, Canada",
  "We are looking for an SRE to run our Kubernetes platform.",
  "Compensation: $120,000 – $150,000 CAD",
].join("\n");

describe("clampPaste", () => {
  it("trims surrounding whitespace", () => {
    expect(clampPaste("  hello  ")).toBe("hello");
  });
  it("caps the paste so one bad copy can't run up a bill", () => {
    expect(clampPaste("x".repeat(MAX_PASTE_CHARS + 5000))).toHaveLength(MAX_PASTE_CHARS);
  });
  it("leaves a normal posting untouched", () => {
    expect(clampPaste(JD)).toBe(JD);
  });
});

describe("buildExtractMessages", () => {
  it("puts the posting in the user turn, instructions in the system turn", () => {
    const { system, user } = buildExtractMessages(JD);
    expect(user).toContain("Senior Site Reliability Engineer");
    expect(system).not.toContain("Senior Site Reliability Engineer");
  });
  it("tells the model to return null rather than guess", () => {
    expect(buildExtractMessages(JD).system).toMatch(/null/i);
  });
});

describe("normalizeExtract", () => {
  it("keeps the three fields as trimmed strings", () => {
    expect(
      normalizeExtract({ company: " IBM ", title: " SRE ", salary: " $120k ", location: " Vancouver, BC " }),
    ).toEqual({
      company: "IBM",
      title: "SRE",
      salary: "$120k",
      location: "Vancouver, BC",
    });
  });

  it("turns missing, empty and literal-null answers into null", () => {
    const blank = { company: null, title: null, salary: null, location: null };
    expect(normalizeExtract({})).toEqual(blank);
    expect(normalizeExtract({ company: "", title: "   ", salary: null, location: "" })).toEqual(blank);
  });

  it("rejects the model writing the word null as a value", () => {
    // Structured output still lets a model emit the string "null"/"N/A"; storing
    // that would put the word "null" in the company column.
    for (const junk of ["null", "None", "n/a", "N/A", "unknown", "not specified"]) {
      expect(normalizeExtract({ company: junk }).company, junk).toBeNull();
    }
  });

  it("survives a non-object response", () => {
    const blank = { company: null, title: null, salary: null, location: null };
    expect(normalizeExtract(null)).toEqual(blank);
    expect(normalizeExtract("nope")).toEqual(blank);
  });
});

describe("isExtractionEnabled", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  it("is off without an API key", () => {
    expect(isExtractionEnabled()).toBe(false);
  });
  it("is on with one", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(isExtractionEnabled()).toBe(true);
  });
});

describe("extractFromText", () => {
  const reply = (text: string, stop: string = "end_turn") => ({
    stop_reason: stop,
    content: [{ type: "text", text }],
  });

  it("returns the normalized fields from the model", async () => {
    const client = {
      messages: {
        create: async () =>
          reply(JSON.stringify({ company: "IBM", title: "SRE", salary: "$120k" })),
      },
    };
    expect(await extractFromText(JD, client as never)).toEqual({
      company: "IBM",
      title: "SRE",
      salary: "$120k",
      location: null,
    });
  });

  it("returns null on a refusal instead of inventing fields", async () => {
    const client = { messages: { create: async () => reply("{}", "refusal") } };
    expect(await extractFromText(JD, client as never)).toBeNull();
  });

  it("returns null when the reply isn't JSON", async () => {
    const client = { messages: { create: async () => reply("sorry, I can't") } };
    expect(await extractFromText(JD, client as never)).toBeNull();
  });

  it("returns null when the API call throws, rather than propagating", async () => {
    const client = {
      messages: {
        create: async () => {
          throw new Error("rate limited");
        },
      },
    };
    expect(await extractFromText(JD, client as never)).toBeNull();
  });

  it("sends the clamped text, not the raw paste", async () => {
    let sent = "";
    const client = {
      messages: {
        create: async (p: { messages: { content: string }[] }) => {
          sent = p.messages[0].content;
          return reply(JSON.stringify({ company: "IBM" }));
        },
      },
    };
    await extractFromText("y".repeat(MAX_PASTE_CHARS + 1000), client as never);
    expect(sent.length).toBeLessThanOrEqual(MAX_PASTE_CHARS + 200); // + prompt scaffolding
  });
});
