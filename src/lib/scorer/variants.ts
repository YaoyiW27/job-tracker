// Discover the resume variants the scorer chooses between.
//
// Locally that means every `.tex` in .private/. On a deployment there is no
// .private/ (it is gitignored and never shipped), so the same content can come
// from base64 env vars instead — see loadScoreContext in ./index.ts.
//
// The id is the filename's last underscore-separated segment
// (YaoyiWang_Resume_AIops.tex -> "AIops"), and the human label comes from a
// `% variant: ...` comment at the top of the file, so adding or renaming a
// resume never means editing this code.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stripLatex } from "./latex";
import type { ResumeVariant } from "./prompt";

const LABEL = /^%\s*variant:\s*(.+)$/im;
const RESUME_ENV = /^SCORER_RESUME_(.+)_B64$/;
const PREFERENCES_ENV = "SCORER_PREFERENCES_B64";

/** Build a variant from raw LaTeX. Shared by the file and env paths. */
function toVariant(id: string, raw: string): ResumeVariant {
  // Read the label before stripping — stripLatex drops comments.
  const label = LABEL.exec(raw)?.[1].trim() || id;
  return { id, label, text: stripLatex(raw).trim() };
}

function decode(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const text = Buffer.from(value, "base64").toString("utf-8").trim();
  return text || null;
}

export function discoverResumeVariants(privateDir: string): ResumeVariant[] {
  return readdirSync(privateDir)
    .filter((f) => f.endsWith(".tex"))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(privateDir, file), "utf-8");
      const id = file.replace(/\.tex$/, "").split("_").pop() || file;
      return toVariant(id, raw);
    });
}

/** Preferences from SCORER_PREFERENCES_B64, or null when not configured. */
export function preferencesFromEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string | null {
  return decode(env[PREFERENCES_ENV]);
}

/**
 * Resume variants from SCORER_RESUME_<ID>_B64 env vars — the deployment's
 * stand-in for .private/. Sorted by id so the order matches the file path.
 */
export function variantsFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ResumeVariant[] {
  return Object.keys(env)
    .map((key) => ({ key, id: RESUME_ENV.exec(key)?.[1] }))
    .filter((m): m is { key: string; id: string } => Boolean(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ key, id }) => {
      const raw = decode(env[key]);
      return raw ? toVariant(id, raw) : null;
    })
    .filter((v): v is ResumeVariant => v !== null);
}
