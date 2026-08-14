"use client";

import * as React from "react";
import type { Application } from "@prisma/client";
import { STATUS_ORDER, groupByStatus, movePatch } from "@/lib/kanban";

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

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => (
        <div
          key={status}
          onDragOver={(e) => {
            e.preventDefault();
            setOverCol(status);
          }}
          onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
          onDrop={() => drop(status)}
          className={`flex w-64 shrink-0 flex-col rounded-lg border bg-muted/20 ${
            overCol === status ? "ring-2 ring-ring" : ""
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
            <span>{status}</span>
            <span>{groups[status].length}</span>
          </div>
          <div className="flex min-h-[60px] flex-col gap-2 p-2">
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
                    <p className="truncate text-sm font-medium">{a.company}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.title}</p>
                  </div>
                  <button
                    onClick={() => del(a)}
                    aria-label="Delete card"
                    className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
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
      ))}
    </div>
  );
}
