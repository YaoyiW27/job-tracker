"use client";

import { useState } from "react";

import { countWords, MIN_DESCRIPTION_WORDS } from "@/lib/scorer/prompt";

interface AnswerResponse {
  answer: string;
  fromPosting: string[];
  fromResume: string[];
  gaps: string[];
  wordCount: number;
  resumeUsed: { id: string; label: string };
}

interface ScoreResponse {
  fitScore: number;
  fitReason: string;
  betterResume: string;
  resumeReason: string;
  company: string;
  title: string;
  variants: { id: string; label: string }[];
}

export default function MatchPage() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Drafting an answer is a separate, opt-in step: it only matters once the
  // score has convinced you to apply.
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [answerError, setAnswerError] = useState("");
  const [copied, setCopied] = useState(false);

  async function draft() {
    setDrafting(true);
    setAnswerError("");
    setAnswer(null);
    setCopied(false);
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          question,
          notes,
          company: result?.company,
          resumeId: result?.betterResume,
          force: true, // the score already ran on this same text
        }),
      });
      const body = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = body ? JSON.parse(body) : {};
      } catch {
        setAnswerError(`Draft failed (HTTP ${res.status}).`);
        return;
      }
      if (!res.ok) {
        setAnswerError((data.error as string) ?? `Draft failed (HTTP ${res.status})`);
        return;
      }
      setAnswer(data as unknown as AnswerResponse);
    } catch (e) {
      setAnswerError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  // Same helper and threshold the server gate uses, so the live counter can
  // never disagree with what the API will accept.
  const words = countWords(description);
  const truncated = words > 0 && words < MIN_DESCRIPTION_WORDS;

  async function score(force = false) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/score-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, force }),
      });
      // A crashed or timed-out function returns an empty body, and res.json()
      // then throws "Unexpected end of JSON input" — which tells you nothing.
      // Read the text first so the status code still says something useful.
      const body = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = body ? JSON.parse(body) : {};
      } catch {
        setError(`Scoring failed (HTTP ${res.status}). ${body.slice(0, 200) || "Empty response."}`);
        return;
      }
      if (!res.ok) {
        setError((data.error as string) ?? `Scoring failed (HTTP ${res.status})`);
        return;
      }
      setResult(data as unknown as ScoreResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Which resume?</h1>
        <p className="text-sm text-muted-foreground">
          Paste the whole posting — company, role, location and salary are all read from the text.
          Paste it, don&apos;t link it: LinkedIn and most boards block server-side fetching.
        </p>
      </header>

      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Job description{" "}
          <span className={truncated ? "text-amber-600" : "text-muted-foreground"}>
            ({words} words{truncated ? " — looks truncated" : ""})
          </span>
        </span>
        <textarea
          className="h-64 w-full rounded-md border p-3 font-mono text-xs"
          placeholder='Expand "Show more" on the posting first, then paste everything.'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <button
        className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        disabled={loading || !description.trim()}
        onClick={() => score()}
      >
        {loading ? "Scoring…" : "Score"}
      </button>

      {error && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p>{error}</p>
          {error.includes("partial copy") && (
            <button className="underline" onClick={() => score(true)}>
              Score it anyway
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4 rounded-md border p-5">
          <div>
            <p className="text-sm font-medium">
              {result.title} <span className="text-muted-foreground">at</span> {result.company}
            </p>
            {(result.company === "unknown" || result.title === "unknown") && (
              <p className="text-xs text-amber-600">
                Couldn&apos;t read that from the text — LinkedIn keeps the company in the page
                header, so a body-only copy can miss it. Re-copy from the top if the score looks off.
              </p>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold">{result.fitScore}</span>
            <span className="text-sm text-muted-foreground">/ 100 fit</span>
          </div>
          <p className="text-sm">{result.fitReason}</p>

          <div className="border-t pt-4">
            <p className="text-sm font-medium">
              Send:{" "}
              <span className="rounded bg-foreground px-2 py-0.5 text-background">
                {result.betterResume}
              </span>
            </p>
            {result.resumeReason && (
              <p className="mt-1 text-sm text-muted-foreground">{result.resumeReason}</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Considered: {result.variants.map((v) => v.id).join(", ")}
            </p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Answer a form question</p>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                The question, as the form words it (optional)
              </span>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder={`Why are you interested in working for ${result.company}?`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                What you know that isn&apos;t in the posting (optional) — a referral, something a
                friend on the team told you
              </span>
              <textarea
                className="h-16 w-full rounded-md border px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={drafting}
              onClick={() => draft()}
            >
              {drafting ? "Drafting…" : "Draft answer"}
            </button>

            {answerError && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                {answerError}
              </p>
            )}

            {answer && (
              <div className="space-y-3 rounded-md bg-muted/40 p-4">
                <p className="whitespace-pre-wrap text-sm">{answer.answer}</p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <button
                    className="rounded border px-2 py-1 hover:bg-background"
                    onClick={() => {
                      navigator.clipboard.writeText(answer.answer);
                      setCopied(true);
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <span>
                    {answer.wordCount} words · from {answer.resumeUsed.id}
                  </span>
                </div>

                {/* The grounding, so a fabricated claim is visible without
                    re-reading the posting line by line. */}
                <div className="grid gap-3 border-t pt-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-medium">From the posting</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {answer.fromPosting.length ? (
                        answer.fromPosting.map((x) => <li key={x}>{x}</li>)
                      ) : (
                        <li>nothing — the answer makes no company-specific claim</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">From your résumé</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {answer.fromResume.length ? (
                        answer.fromResume.map((x) => <li key={x}>{x}</li>)
                      ) : (
                        <li>nothing</li>
                      )}
                    </ul>
                  </div>
                </div>

                {answer.gaps.length > 0 && (
                  <div className="border-t pt-3 text-xs">
                    <p className="font-medium text-amber-700">
                      Asked for, but nothing backs it up — write this part yourself
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {answer.gaps.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
