import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const extractFromText = vi.fn();

// Only the model call is stubbed; the guards under test are the real ones.
vi.mock("@/lib/prefill-text", async () => {
  const actual = await vi.importActual<typeof import("@/lib/prefill-text")>("@/lib/prefill-text");
  return { ...actual, extractFromText: (...a: unknown[]) => extractFromText(...a) };
});

const { POST } = await import("@/app/api/prefill/route");

function post(body: unknown) {
  return POST(
    new Request("https://example.test/api/prefill", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const JD = "Senior SRE at IBM, Vancouver BC. $120,000 - $150,000 CAD.";

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
  extractFromText.mockResolvedValue({ company: "IBM", title: "Senior SRE", salary: "$120,000 - $150,000 CAD" });
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  vi.clearAllMocks();
});

describe("POST /api/prefill with { text }", () => {
  it("returns the extracted fields tagged as coming from the paste", async () => {
    const res = await post({ text: JD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      company: "IBM",
      title: "Senior SRE",
      salary: "$120,000 - $150,000 CAD",
      via: ["pasted text"],
    });
  });

  it("prefers the paste when both text and url are sent — the paste is the better signal", async () => {
    await post({ text: JD, url: "https://careers.ibm.com/whatever" });
    expect(extractFromText).toHaveBeenCalledOnce();
  });

  it("maps missing fields to blanks rather than the string 'null'", async () => {
    extractFromText.mockResolvedValue({ company: "IBM", title: null, salary: null });
    expect(await (await post({ text: JD })).json()).toEqual({
      company: "IBM",
      title: "",
      salary: null,
      via: ["pasted text"],
    });
  });

  it("soft-fails with a reason when the model gives nothing usable", async () => {
    extractFromText.mockResolvedValue(null);
    const res = await post({ text: JD });
    expect(res.status).toBe(200); // the dialog stays usable
    expect((await res.json()).error).toBeTruthy();
  });

  it("answers 503, not a crash, when no API key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await post({ text: JD });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/ANTHROPIC_API_KEY/);
    expect(extractFromText).not.toHaveBeenCalled();
  });

  it("ignores a whitespace-only paste and asks for input", async () => {
    const res = await post({ text: "   " });
    expect(res.status).toBe(400);
    expect(extractFromText).not.toHaveBeenCalled();
  });

  it("still rejects a body with neither field", async () => {
    expect((await post({})).status).toBe(400);
  });

  it("rejects a malformed body", async () => {
    expect((await post("not json")).status).toBe(400);
  });
});
