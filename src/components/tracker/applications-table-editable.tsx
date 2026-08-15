"use client";

import * as React from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { Application } from "@prisma/client";
import { APP_STATUS } from "@/lib/enums";
import {
  buildPatch,
  toEditableRow,
  withAppliedDateDefault,
  type EditableField,
  type EditableRow,
} from "@/lib/application-edit";

const STATUSES = Object.values(APP_STATUS);

type Props = {
  rows: Application[];
  onPatched: (app: Application) => void;
  onDeleted: (id: string) => void;
};

const inputCls =
  "w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-input focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring";

export function ApplicationsTableEditable({ rows, onPatched, onDeleted }: Props) {
  const [drafts, setDrafts] = React.useState<Record<string, EditableRow>>({});
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const getDraft = React.useCallback(
    (row: Application): EditableRow => drafts[row.id] ?? toEditableRow(row),
    [drafts],
  );

  const editField = (row: Application, field: EditableField, value: string) => {
    setDrafts((d) => ({
      ...d,
      [row.id]: { ...(d[row.id] ?? toEditableRow(row)), [field]: value },
    }));
  };

  const commit = React.useCallback(
    async (row: Application) => {
      const draft = drafts[row.id] ?? toEditableRow(row);
      const original = toEditableRow(row);
      const patch = withAppliedDateDefault(buildPatch(original, draft), original);
      if (Object.keys(patch).length === 0) return;
      setSavingId(row.id);
      try {
        const res = await fetch(`/api/applications/${row.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const updated: Application = await res.json();
          setDrafts((d) => ({ ...d, [row.id]: toEditableRow(updated) }));
          onPatched(updated);
        } else {
          // revert to the server's values
          setDrafts((d) => ({ ...d, [row.id]: toEditableRow(row) }));
        }
      } finally {
        setSavingId(null);
      }
    },
    [drafts, onPatched],
  );

  const remove = async (row: Application) => {
    if (!window.confirm(`Delete “${row.title}” at ${row.company}?`)) return;
    const res = await fetch(`/api/applications/${row.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(row.id);
  };

  const textCell = (row: Application, field: EditableField, type = "text") => (
    <input
      type={type}
      value={getDraft(row)[field]}
      onChange={(e) => editField(row, field, e.target.value)}
      onBlur={() => commit(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={inputCls}
    />
  );

  const ch = createColumnHelper<Application>();
  const columns = React.useMemo(
    () => [
      ch.accessor("company", { header: "Company", cell: ({ row }) => textCell(row.original, "company") }),
      ch.accessor("title", { header: "Title", cell: ({ row }) => textCell(row.original, "title") }),
      ch.accessor("status", {
        header: "Status",
        cell: ({ row }) => (
          <select
            value={getDraft(row.original).status}
            onChange={(e) => {
              editField(row.original, "status", e.target.value);
              // commit immediately after state settles
              setTimeout(() => commit(row.original), 0);
            }}
            className={inputCls}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ),
      }),
      ch.accessor((r) => (r.appliedDate ? String(r.appliedDate) : ""), {
        id: "appliedDate",
        header: "Applied",
        cell: ({ row }) => textCell(row.original, "appliedDate", "date"),
      }),
      ch.accessor("salary", { header: "Salary", cell: ({ row }) => textCell(row.original, "salary") }),
      ch.accessor("notes", {
        header: "Notes",
        enableSorting: false,
        cell: ({ row }) => textCell(row.original, "notes"),
      }),
      ch.display({
        id: "url",
        header: "Link",
        cell: ({ row }) =>
          row.original.url ? (
            <a
              href={row.original.url}
              target="_blank"
              rel="noreferrer"
              className="px-2 text-blue-600 hover:underline dark:text-blue-400"
            >
              open
            </a>
          ) : (
            <span className="px-2 text-muted-foreground">—</span>
          ),
      }),
      ch.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            onClick={() => remove(row.original)}
            className="px-2 text-xs text-muted-foreground hover:text-destructive"
            aria-label="Delete row"
          >
            Delete
          </button>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No applications yet. Click <span className="font-medium">+ Add row</span> to add your first one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-3 py-2 font-medium">
                  {h.isPlaceholder ? null : (
                    <button
                      type="button"
                      disabled={!h.column.getCanSort()}
                      onClick={h.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1 disabled:cursor-default"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: "▲", desc: "▼" }[h.column.getIsSorted() as string] ?? ""}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b last:border-0 ${savingId === row.original.id ? "opacity-60" : ""}`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-1 py-1 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
