import { describe, it, expect } from "vitest";
import { scoreJob, type ScoreContext, type JobMeta } from "@/lib/scorer";

const ctx: ScoreContext = {
  preferences: "p",
  variants: [
    { id: "AIops", label: "infra / platform", text: "Terraform" },
    { id: "AIinfra", label: "ML infra", text: "vLLM" },
  ],
  model: "claude-haiku-4-5",
};
const job: JobMeta = {
  company: "Acme",
  title: "SWE",
  locations: ["Vancouver, BC"],
  terms: [],
  locationFit: "VANCOUVER",
  salary: null,
};

// Minimal stub client — no network, no API key.
function stub(create: (p: unknown) => Promise<unknown>) {
  return { messages: { create } } as unknown as Parameters<typeof scoreJob>[2];
}

describe("scoreJob (skip-safe)", () => {
  it("returns null (skips) when the model rejects the request", async () => {
    const c = stub(async () => {
      throw new Error("400 This model does not support the effort parameter.");
    });
    expect(await scoreJob(job, ctx, c)).toBeNull();
  });

  it("returns null on a refusal", async () => {
    const c = stub(async () => ({ stop_reason: "refusal", content: [] }));
    expect(await scoreJob(job, ctx, c)).toBeNull();
  });

  it("parses a successful structured response", async () => {
    const c = stub(async () => ({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({ fitScore: 82, fitReason: "AI-forward", betterResume: "AIinfra", resumeReason: "LLM serving" }),
        },
      ],
    }));
    const r = await scoreJob(job, ctx, c);
    expect(r?.fitScore).toBe(82);
    expect(r?.betterResume).toBe("AIinfra");
  });
});
