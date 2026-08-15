// Discover the resume variants the scorer chooses between.
//
// Every `.tex` in .private/ is a variant. The id is the filename's last
// underscore-separated segment (YaoyiWang_Resume_AIops.tex -> "AIops"), and the
// human label comes from a `% variant: ...` comment at the top of the file, so
// adding or renaming a resume never means editing this code.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stripLatex } from "./latex";
import type { ResumeVariant } from "./prompt";

const LABEL = /^%\s*variant:\s*(.+)$/im;

export function discoverResumeVariants(privateDir: string): ResumeVariant[] {
  return readdirSync(privateDir)
    .filter((f) => f.endsWith(".tex"))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(privateDir, file), "utf-8");
      const id = file.replace(/\.tex$/, "").split("_").pop() || file;
      // Read the label before stripping — stripLatex drops comments.
      const label = LABEL.exec(raw)?.[1].trim() || id;
      return { id, label, text: stripLatex(raw).trim() };
    });
}
