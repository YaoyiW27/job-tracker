"use client";

import * as React from "react";
import type { Application } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { AddRowDialog } from "./add-row-dialog";
import { ApplicationsTableEditable } from "./applications-table-editable";
import { KanbanBoard } from "./kanban-board";

type View = "table" | "board";

export function TrackerClient({ initial }: { initial: Application[] }) {
  const [apps, setApps] = React.useState<Application[]>(initial);
  const [view, setView] = React.useState<View>("table");

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
            {apps.length} {apps.length === 1 ? "application" : "applications"}
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
          <AddRowDialog onCreated={onCreated} />
        </div>
      </div>

      {view === "table" ? (
        <ApplicationsTableEditable rows={apps} onPatched={onPatched} onDeleted={onDeleted} />
      ) : (
        <KanbanBoard rows={apps} onPatched={onPatched} onDeleted={onDeleted} />
      )}
    </div>
  );
}
