import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MIN_DESCRIPTION_WORDS, countWords } from "@/lib/scorer/prompt";

const scoreJob = vi.fn();
const loadScoreContext = vi.fn();

// Only the model call is stubbed; the guards under test are the real ones.
vi.mock("@/lib/scorer", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scorer/prompt")>(
    "@/lib/scorer/prompt",
  );
  return {
    ...actual,
    scoreJob: (...args: unknown[]) => scoreJob(...args),
    loadScoreContext: () => loadScoreContext(),
  };
});

const { POST } = await import("@/app/api/score-jd/route");

function post(body: unknown) {
  return POST(
    new Request("https://example.test/api/score-jd", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const FULL = "word ".repeat(MIN_DESCRIPTION_WORDS + 10);

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
  loadScoreContext.mockReturnValue({
    preferences: "p",
    variants: [{ id: "AIops", label: "infra", text: "Terraform" }],
    model: "claude-haiku-4-5",
  });
  scoreJob.mockResolvedValue({
    company: "Clio",
    title: "Systems Engineer",
    fitScore: 83,
    fitReason: "AI-forward platform role",
    betterResume: "AIops",
    resumeReason: "platform match",
  });
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  vi.clearAllMocks();
});

describe("POST /api/score-jd", () => {
  it("503s when no API key is configured, rather than pretending to score", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await post({ description: FULL })).status).toBe(503);
  });

  it("400s on a malformed body", async () => {
    expect((await post("{not json")).status).toBe(400);
  });

  it("400s when there is no description", async () => {
    expect((await post({ description: "   " })).status).toBe(400);
  });

  it("refuses a truncated paste and never calls the model", async () => {
    // The regression this endpoint exists to avoid: 15 words scored into a
    // confident number that reads as a weak job rather than a bad copy.
    const res = await post({ description: "Design and maintain AWS infrastructure for production" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.truncated).toBe(true);
    expect(scoreJob).not.toHaveBeenCalled();
  });

  it("scores a short description when force is set, since terse postings exist", async () => {
    const res = await post({ description: "Short but real posting", force: true });
    expect(res.status).toBe(200);
    expect(scoreJob).toHaveBeenCalled();
  });

  it("returns the score plus the variants it considered", async () => {
    const res = await post({ description: FULL });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fitScore).toBe(83);
    expect(body.betterResume).toBe("AIops");
    expect(body.company).toBe("Clio");
    expect(body.variants).toEqual([{ id: "AIops", label: "infra" }]);
  });

  it("502s when the model returns nothing usable", async () => {
    scoreJob.mockResolvedValue(null);
    expect((await post({ description: FULL })).status).toBe(502);
  });

  it("passes the description through to the scorer", async () => {
    await post({ description: FULL });
    expect(scoreJob.mock.calls[0][0]).toMatchObject({ description: FULL.trim() });
  });
});

describe("countWords", () => {
  it("is the one counter the live UI and the server gate both use", () => {
    // If these ever diverge, the textarea can show a green count for input the
    // API will reject.
    expect(countWords("a b c")).toBe(3);
    expect(countWords("  a \n\n b \t c  ")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});
