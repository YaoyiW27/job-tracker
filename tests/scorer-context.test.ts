import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { variantsFromEnv, preferencesFromEnv } from "@/lib/scorer/variants";
import { loadScoreContext, ScoreContextError } from "@/lib/scorer";

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");

const RESUME_A = "% variant: Infra / Platform\n\\textbf{Yaoyi} — Kubernetes, Terraform";
const RESUME_B = "% variant: ML Infra\n\\textbf{Yaoyi} — vLLM, CUDA";

describe("preferencesFromEnv", () => {
  it("decodes base64 preferences", () => {
    expect(preferencesFromEnv({ SCORER_PREFERENCES_B64: b64("prefer builders") })).toBe(
      "prefer builders",
    );
  });
  it("returns null when unset", () => {
    expect(preferencesFromEnv({})).toBeNull();
  });
  it("returns null rather than throwing on undecodable input", () => {
    expect(preferencesFromEnv({ SCORER_PREFERENCES_B64: "   " })).toBeNull();
  });
});

describe("variantsFromEnv", () => {
  const env = {
    SCORER_RESUME_INFRA_B64: b64(RESUME_A),
    SCORER_RESUME_MLINFRA_B64: b64(RESUME_B),
    UNRELATED: "x",
  };

  it("finds one variant per SCORER_RESUME_*_B64 key", () => {
    expect(variantsFromEnv(env).map((v) => v.id)).toEqual(["INFRA", "MLINFRA"]);
  });

  it("reads the label from the % variant: comment, same as the files do", () => {
    expect(variantsFromEnv(env).map((v) => v.label)).toEqual(["Infra / Platform", "ML Infra"]);
  });

  it("strips LaTeX out of the decoded text", () => {
    expect(variantsFromEnv(env)[0].text).toContain("Yaoyi");
    expect(variantsFromEnv(env)[0].text).not.toContain("\\textbf");
  });

  it("sorts by id so variant order is stable across deployments", () => {
    const shuffled = {
      SCORER_RESUME_ZED_B64: b64(RESUME_A),
      SCORER_RESUME_ALPHA_B64: b64(RESUME_B),
    };
    expect(variantsFromEnv(shuffled).map((v) => v.id)).toEqual(["ALPHA", "ZED"]);
  });

  it("returns an empty list when nothing is configured", () => {
    expect(variantsFromEnv({})).toEqual([]);
  });

  it("skips a variant that decodes to nothing instead of shipping an empty resume", () => {
    expect(variantsFromEnv({ SCORER_RESUME_BROKEN_B64: b64("   ") })).toEqual([]);
  });
});

describe("loadScoreContext sources", () => {
  const MISSING = "/nonexistent/.private";
  const env = {
    SCORER_PREFERENCES_B64: b64("prefer builders"),
    SCORER_RESUME_INFRA_B64: b64(RESUME_A),
  };

  it("falls back to env vars when there is no .private/ — the deployed case", () => {
    const ctx = loadScoreContext(MISSING, env);
    expect(ctx.preferences).toBe("prefer builders");
    expect(ctx.variants.map((v) => v.id)).toEqual(["INFRA"]);
  });

  it("prefers .private/ on disk over env vars, so local edits win", () => {
    const ctx = loadScoreContext(join(process.cwd(), ".private"), env);
    expect(ctx.preferences).not.toBe("prefer builders");
    expect(ctx.variants.length).toBeGreaterThan(1);
  });

  it("throws a named error, not ENOENT, when neither source is configured", () => {
    expect(() => loadScoreContext(MISSING, {})).toThrow(ScoreContextError);
  });

  it("does not accept preferences without any resume", () => {
    const partial = { SCORER_PREFERENCES_B64: b64("prefer builders") };
    expect(() => loadScoreContext(MISSING, partial)).toThrow(ScoreContextError);
  });
});
