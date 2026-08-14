"use client";

import * as React from "react";
import type { Application } from "@prisma/client";
import { AddRowDialog } from "./add-row-dialog";
import { ApplicationsTableEditable } from "./applications-table-editable";

export function TrackerClient({ initial }: { initial: Application[] }) {
  const [apps, setApps] = React.useState<Application[]>(initial);

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
        <AddRowDialog onCreated={onCreated} />
      </div>
      <ApplicationsTableEditable rows={apps} onPatched={onPatched} onDeleted={onDeleted} />
    </div>
  );
}
