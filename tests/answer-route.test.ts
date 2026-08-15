import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MIN_DESCRIPTION_WORDS } from "@/lib/scorer/prompt";

const draftAnswer = vi.fn();
const loadScoreContext = vi.fn();

vi.mock("@/lib/answer", () => ({ draftAnswer: (...a: unknown[]) => draftAnswer(...a) }));

vi.mock("@/lib/scorer", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scorer/prompt")>("@/lib/scorer/prompt");
  const real = await vi.importActual<typeof import("@/lib/scorer")>("@/lib/scorer");
  return {
    ...actual,
    ScoreContextError: real.ScoreContextError,
    loadScoreContext: () => loadScoreContext(),
  };
});

const { POST } = await import("@/app/api/answer/route");

const FULL = "word ".repeat(MIN_DESCRIPTION_WORDS + 10);

function post(body: unknown) {
  return POST(
    new Request("https://example.test/api/answer", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
  loadScoreContext.mockReturnValue({
    preferences: "p",
    style: "terse",
    variants: [
      { id: "AIops", label: "infra / platform", text: "Terraform" },
      { id: "AIeng", label: "AI engineer", text: "LangGraph" },
    ],
    model: "claude-sonnet-5",
  });
  draftAnswer.mockResolvedValue({
    answer: "I build platform tooling.",
    fromPosting: ["agent sandboxes"],
    fromResume: ["Terraform"],
    gaps: [],
    wordCount: 4,
  });
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  vi.clearAllMocks();
});

describe("POST /api/answer", () => {
  it("returns the draft and says which résumé it argued from", async () => {
    const res = await post({ description: FULL, resumeId: "AIeng" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toBe("I build platform tooling.");
    expect(body.resumeUsed).toEqual({ id: "AIeng", label: "AI engineer" });
  });

  it("argues from the résumé the scorer picked, not a default", async () => {
    await post({ description: FULL, resumeId: "AIeng" });
    expect(draftAnswer.mock.calls[0][1].variant.id).toBe("AIeng");
  });

  it("falls back to the first variant when the id is unknown", async () => {
    await post({ description: FULL, resumeId: "NOPE" });
    expect(draftAnswer.mock.calls[0][1].variant.id).toBe("AIops");
  });

  it("passes the form's own wording and my extra notes through", async () => {
    await post({
      description: FULL,
      question: "What interests you about this role?",
      notes: "a friend on the team said they're rewriting the ingest path",
    });
    const req = draftAnswer.mock.calls[0][0];
    expect(req.question).toBe("What interests you about this role?");
    expect(req.notes).toContain("ingest path");
  });

  it("refuses a truncated paste — a fragment yields a confident, wrong answer", async () => {
    const res = await post({ description: "too short", question: "why?" });
    expect(res.status).toBe(400);
    expect((await res.json()).truncated).toBe(true);
    expect(draftAnswer).not.toHaveBeenCalled();
  });

  it("drafts anyway when the caller insists", async () => {
    expect((await post({ description: "too short", force: true })).status).toBe(200);
  });

  it("answers 503 without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await post({ description: FULL })).status).toBe(503);
    expect(draftAnswer).not.toHaveBeenCalled();
  });

  it("answers 503, not a crash, when .private/ and the env vars are both missing", async () => {
    const { ScoreContextError } = await import("@/lib/scorer");
    loadScoreContext.mockImplementation(() => {
      throw new ScoreContextError("Scorer context unavailable: …");
    });
    const res = await post({ description: FULL });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("unavailable");
  });

  it("reports a model refusal instead of returning an empty body", async () => {
    draftAnswer.mockResolvedValue(null);
    const res = await post({ description: FULL });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBeTruthy();
  });

  it("requires a description", async () => {
    expect((await post({ question: "why?" })).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
  });
});
