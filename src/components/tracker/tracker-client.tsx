"use client";

import * as React from "react";
import type { Application } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { AddRowDialog } from "./add-row-dialog";
import { ApplicationsTableEditable } from "./applications-table-editable";
import { KanbanBoard } from "./kanban-board";
import { FILTER_STATUSES, countByStatus, filterByStatus } from "@/lib/status-filter";
import { statusStyle } from "@/lib/status-style";

type View = "table" | "board";

export interface ResumeOption {
  id: string;
  label: string;
}

export function TrackerClient({
  initial,
  resumes,
}: {
  initial: Application[];
  resumes: ResumeOption[];
}) {
  const [apps, setApps] = React.useState<Application[]>(initial);
  const [view, setView] = React.useState<View>("table");
  // Single-select, like LinkedIn's tracker: click the active chip to clear it.
  // Only the table narrows — the board is already grouped by status.
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);

  const counts = countByStatus(apps);
  const visible = filterByStatus(apps, statusFilter);

  const onCreated = (app: Application) => setApps((prev) => [app, ...prev]);
  const onPatched = (app: Application) =>
    setApps((prev) => prev.map((a) => (a.id === app.id ? app : a)));
  const onDeleted = (id: string) => setApps((prev) => prev.filter((a) => a.id !== id));

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tracker</h1>
          <p className="text-sm text-muted-foreground">
            {statusFilter && view === "table"
              ? `${visible.length} of ${apps.length} applications`
              : `${apps.length} ${apps.length === 1 ? "application" : "applications"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <Button
              size="sm"
              variant={view === "table" ? "default" : "ghost"}
              onClick={() => setView("table")}
            >
              Table
            </Button>
            <Button
              size="sm"
              variant={view === "board" ? "default" : "ghost"}
              onClick={() => setView("board")}
            >
              Board
            </Button>
          </div>
          <AddRowDialog onCreated={onCreated} resumes={resumes} />
        </div>
      </div>

      {view === "table" && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              statusFilter === null ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            All · {apps.length}
          </button>
          {FILTER_STATUSES.map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? null : s)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  active ? "bg-foreground text-background" : "hover:bg-muted"
                }`}
              >
                <span className={`size-1.5 rounded-full ${statusStyle(s).dot}`} />
                {s} · {counts[s]}
              </button>
            );
          })}
        </div>
      )}

      {view === "table" ? (
        <ApplicationsTableEditable
          rows={visible}
          resumes={resumes}
          onPatched={onPatched}
          onDeleted={onDeleted}
        />
      ) : (
        <KanbanBoard rows={apps} onPatched={onPatched} onDeleted={onDeleted} />
      )}
    </div>
  );
}
