"use client";

import * as React from "react";
import type { Application } from "@prisma/client";
import { BOARD_GROUPS, groupByStatus, movePatch } from "@/lib/kanban";
import type { AppStatus } from "@/lib/enums";
import { statusStyle } from "@/lib/status-style";

type Props = {
  rows: Application[];
  onPatched: (app: Application) => void;
  onDeleted: (id: string) => void;
};

export function KanbanBoard({ rows, onPatched, onDeleted }: Props) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overCol, setOverCol] = React.useState<string | null>(null);
  const groups = groupByStatus(rows);

  async function drop(toStatus: string) {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const card = rows.find((r) => r.id === id);
    if (!card) return;
    const patch = movePatch(card, toStatus);
    if (!patch) return;
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) onPatched(await res.json());
  }

  async function del(card: Application) {
    if (!window.confirm(`Delete “${card.title}” at ${card.company}?`)) return;
    const res = await fetch(`/api/applications/${card.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(card.id);
  }

  const column = (status: AppStatus) => {
    const style = statusStyle(status);
    return (
      <div
        key={status}
        onDragOver={(e) => {
          e.preventDefault();
          setOverCol(status);
        }}
        onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
        onDrop={() => drop(status)}
        className={`flex flex-col rounded-lg border ${style.column} ${
          overCol === status ? "ring-2 ring-ring" : ""
        }`}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className={`size-2 shrink-0 rounded-full ${style.dot}`} />
          <span className="truncate">{status}</span>
          <span className="ml-auto tabular-nums">{groups[status].length}</span>
        </div>
        <div className="flex min-h-[72px] flex-col gap-2 p-2">
          {groups[status].map((a) => (
            <div
              key={a.id}
              draggable
              onDragStart={() => setDragId(a.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverCol(null);
              }}
              className={`group cursor-grab rounded-md border bg-background p-2 shadow-sm active:cursor-grabbing ${
                dragId === a.id ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {/* Wrapped, not truncated — same reasoning as the table. */}
                  <p className="text-sm font-medium leading-snug">{a.company}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{a.title}</p>
                </div>
                <button
                  onClick={() => del(a)}
                  aria-label="Delete card"
                  className="shrink-0 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                >
                  ✕
                </button>
              </div>
              {(a.appliedDate || a.salary) && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {[
                    a.appliedDate ? new Date(a.appliedDate).toISOString().slice(0, 10) : null,
                    a.salary,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  open
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Three stacked rows rather than one horizontally-scrolling strip: the whole
  // pipeline is visible without dragging a scrollbar, and the split says what
  // is still live versus finished.
  return (
    <div className="space-y-5 pb-4">
      {BOARD_GROUPS.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h3>
          <div
            className={`grid gap-3 ${
              group.statuses.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {group.statuses.map(column)}
          </div>
        </section>
      ))}
    </div>
  );
}
