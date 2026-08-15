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
import { statusStyle } from "@/lib/status-style";
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

/**
 * Editable cell that grows to fit its contents instead of clipping them — a
 * long title or salary range used to be readable only by clicking into the cell
 * and scrolling. Enter commits (Shift+Enter for a real newline).
 */
function GrowingCell({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Resize on every value change, including the ones that arrive from a
  // server round-trip rather than typing.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={`${inputCls} resize-none overflow-hidden leading-snug`}
    />
  );
}

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

  const textCell = (row: Application, field: EditableField, type = "text") =>
    type === "text" ? (
      <GrowingCell
        value={getDraft(row)[field]}
        onChange={(v) => editField(row, field, v)}
        onCommit={() => commit(row)}
      />
    ) : (
      // date / url keep a real input: the native pickers and validation matter
      // more there than wrapping does.
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
      ch.accessor("company", {
        header: "Company",
        cell: ({ row }) => textCell(row.original, "company"),
        meta: { className: "min-w-[8rem]" },
      }),
      // Widths are hints, not a fixed layout: the date input has an intrinsic
      // size that a table-fixed percentage was clipping.
      ch.accessor("title", {
        header: "Title",
        cell: ({ row }) => textCell(row.original, "title"),
        meta: { className: "w-[24%] min-w-[11rem]" },
      }),
      ch.accessor("status", {
        header: "Status",
        meta: { className: "min-w-[7rem]" },
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
      ch.accessor("salary", {
        header: "Salary",
        cell: ({ row }) => textCell(row.original, "salary"),
        meta: { className: "w-[16%] min-w-[9rem]" },
      }),
      ch.accessor("notes", {
        header: "Notes",
        enableSorting: false,
        cell: ({ row }) => textCell(row.original, "notes"),
        meta: { className: "w-[14%]" },
      }),
      // Editable, not just a link: a row added from pasted text has no URL yet,
      // and there was previously no way to add one after the fact.
      ch.display({
        id: "url",
        header: "Link",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {textCell(row.original, "url", "url")}
            {row.original.url && (
              <a
                href={row.original.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 pr-2 text-blue-600 hover:underline dark:text-blue-400"
              >
                open
              </a>
            )}
          </div>
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
                <th
                  key={h.id}
                  className={`px-3 py-2 font-medium ${
                    (h.column.columnDef.meta as { className?: string } | undefined)?.className ?? ""
                  }`}
                >
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
              // Tinted by status so the state of the whole list reads at a
              // glance, without going down the Status column one row at a time.
              className={`border-b transition-colors last:border-0 ${statusStyle(
                getDraft(row.original).status,
              ).row} ${savingId === row.original.id ? "opacity-60" : ""}`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-1 py-1 align-top">
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
