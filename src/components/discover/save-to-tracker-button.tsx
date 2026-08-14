"use client";

import * as React from "react";
import { jobToApplicationInput, type JobLike } from "@/lib/job-save";
import { interpretCreateResponse } from "@/lib/application-draft";

export function SaveToTrackerButton({ job }: { job: JobLike }) {
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");

  async function post(force: boolean) {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...jobToApplicationInput(job), force }),
    });
    return interpretCreateResponse(res.status, await res.json());
  }

  async function save() {
    setState("saving");
    const out = await post(false);
    if (out.kind === "created") {
      setState("saved");
      return;
    }
    if (out.kind === "duplicate") {
      // Same job already linked — it's genuinely saved; don't prompt.
      if (out.reason === "already-saved") {
        setState("saved");
        return;
      }
      // Name-match against a different row — let the user add it anyway.
      const ok = window.confirm(
        `“${out.existing.title}” at ${out.existing.company} is already in your tracker ` +
          `(status ${out.existing.status}). Add it anyway?`,
      );
      if (ok) {
        const again = await post(true);
        setState(again.kind === "created" || again.kind === "duplicate" ? "saved" : "idle");
      } else {
        setState("idle");
      }
      return;
    }
    setState("idle");
    if (out.kind === "invalid" || out.kind === "error") window.alert(out.message);
  }

  if (state === "saved") {
    return <span className="text-xs text-green-600 dark:text-green-400">✓ Saved</span>;
  }
  return (
    <button
      onClick={save}
      disabled={state === "saving"}
      className="text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
    >
      {state === "saving" ? "Saving…" : "Save"}
    </button>
  );
}
