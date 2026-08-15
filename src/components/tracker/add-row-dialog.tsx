"use client";

import * as React from "react";
import type { Application } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APP_STATUS } from "@/lib/enums";
import { appliedDateForNewRow } from "@/lib/application-edit";
import {
  cleanPrefill,
  interpretCreateResponse,
  validateDraft,
  type CreateOutcome,
} from "@/lib/application-draft";
import type { DuplicateMatch } from "@/lib/applications";

const STATUSES = Object.values(APP_STATUS);

const emptyDraft = {
  url: "",
  company: "",
  title: "",
  status: APP_STATUS.SAVED as string,
  appliedDate: "",
  salary: "",
  notes: "",
};

export function AddRowDialog({ onCreated }: { onCreated: (app: Application) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ ...emptyDraft });
  const [errors, setErrors] = React.useState<{ company?: string; title?: string }>({});
  const [prefilling, setPrefilling] = React.useState(false);
  const [prefillNote, setPrefillNote] = React.useState<string | null>(null);
  // Kept out of `draft`: it is input to prefill, never saved on the application.
  const [pasted, setPasted] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [duplicate, setDuplicate] = React.useState<DuplicateMatch | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function reset() {
    setDraft({ ...emptyDraft });
    setErrors({});
    setPrefillNote(null);
    setPasted("");
    setDuplicate(null);
    setMessage(null);
  }

  function close(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handlePrefill(source: "url" | "text") {
    const payload =
      source === "text" ? { text: pasted.trim() } : { url: draft.url.trim() };
    if (!Object.values(payload)[0]) return;

    setPrefilling(true);
    setPrefillNote(null);
    try {
      const res = await fetch("/api/prefill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        setPrefillNote(
          source === "text"
            ? `Couldn't read that posting (${data.error}). Fill it in manually.`
            : `Couldn't read that page (${data.error}). Paste the posting below instead, or fill it in manually.`,
        );
        return;
      }
      const cleaned = cleanPrefill({ company: data.company, title: data.title, salary: data.salary });
      setDraft((d) => ({
        ...d,
        company: cleaned.company || d.company,
        title: cleaned.title || d.title,
        salary: cleaned.salary || d.salary,
      }));
      setPrefillNote(
        cleaned.company || cleaned.title
          ? `Prefilled from ${data.via?.join(", ") || "page"}. Check and edit before saving.`
          : source === "text"
            ? "Nothing recognizable in that text — check you pasted the posting itself."
            : "No company/title found on that page — paste the posting below instead.",
      );
    } catch {
      setPrefillNote("Prefill request failed. Fill it in manually.");
    } finally {
      setPrefilling(false);
    }
  }

  async function post(force: boolean): Promise<CreateOutcome> {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: draft.company,
        title: draft.title,
        url: draft.url.trim() || null,
        status: draft.status,
        // Your date if you typed one; otherwise today when saving straight as
        // APPLIED or further.
        appliedDate: appliedDateForNewRow(draft.status, draft.appliedDate),
        salary: draft.salary || null,
        notes: draft.notes || null,
        force,
      }),
    });
    return interpretCreateResponse(res.status, await res.json());
  }

  function applyOutcome(outcome: CreateOutcome) {
    switch (outcome.kind) {
      case "created":
        onCreated(outcome.application as Application);
        close(false);
        break;
      case "duplicate":
        setDuplicate(outcome.existing);
        break;
      case "invalid":
        setMessage(outcome.message);
        break;
      case "error":
        setMessage(outcome.message);
        break;
    }
  }

  async function handleSave() {
    setMessage(null);
    const v = validateDraft(draft);
    setErrors(v.errors);
    if (!v.ok) return;
    setSaving(true);
    try {
      applyOutcome(await post(false));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAnyway() {
    setSaving(true);
    try {
      applyOutcome(await post(true));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add row</Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogHeader>
          <DialogTitle>Add a job to your tracker</DialogTitle>
          <DialogDescription>
            Paste a job URL to prefill company, title and salary. If the site blocks that
            (IBM, LinkedIn, Workday), paste the posting text instead. Or just type it in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="url">Job URL (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                placeholder="https://…"
                value={draft.url}
                onChange={(e) => set("url", e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrefill("url")}
                disabled={prefilling || !draft.url.trim()}
              >
                {prefilling ? "Reading…" : "Prefill"}
              </Button>
            </div>
            {prefillNote && <p className="text-xs text-muted-foreground">{prefillNote}</p>}
          </div>

          {/* The escape hatch for IBM / LinkedIn / Workday, which answer a
              server-side fetch with a bot check rather than the posting. */}
          <div className="space-y-1.5">
            <Label htmlFor="pasted">Or paste the posting (optional)</Label>
            <Textarea
              id="pasted"
              rows={4}
              placeholder="Paste the job description here if the URL above can't be read…"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrefill("text")}
                disabled={prefilling || !pasted.trim()}
              >
                {prefilling ? "Reading…" : "Extract from text"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Works when the site blocks fetching. The text isn&apos;t saved.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                value={draft.company}
                onChange={(e) => set("company", e.target.value)}
              />
              {errors.company && <p className="text-xs text-destructive">{errors.company}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={draft.status}
                onChange={(e) => set("status", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appliedDate">Applied date</Label>
              <Input
                id="appliedDate"
                type="date"
                value={draft.appliedDate}
                onChange={(e) => set("appliedDate", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="salary">Salary (optional)</Label>
            <Input
              id="salary"
              value={draft.salary}
              onChange={(e) => set("salary", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          {duplicate && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Possible duplicate</p>
              <p className="text-muted-foreground">
                “{duplicate.title}” at {duplicate.company} is already in your tracker
                (status {duplicate.status}). Add it anyway?
              </p>
            </div>
          )}
          {message && <p className="text-sm text-destructive">{message}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={saving}>
            Cancel
          </Button>
          {duplicate ? (
            <Button variant="destructive" onClick={handleSaveAnyway} disabled={saving}>
              {saving ? "Saving…" : "Add anyway"}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </>
  );
}
