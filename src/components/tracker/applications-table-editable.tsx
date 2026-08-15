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
import { statusRank } from "@/lib/kanban";
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
  resumes: { id: string; label: string }[];
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

/** The live handlers, handed to cells through the table rather than a closure. */
interface EditorMeta {
  resumes: { id: string; label: string }[];
  getDraft: (row: Application) => EditableRow;
  editField: (row: Application, field: EditableField, value: string) => void;
  commit: (row: Application) => void;
  remove: (row: Application) => void;
}

function textCell(
  table: { options: { meta?: unknown } },
  row: Application,
  field: EditableField,
  type = "text",
) {
  const m = table.options.meta as EditorMeta;
  return type === "text" ? (
    <GrowingCell
      value={m.getDraft(row)[field]}
      onChange={(v) => m.editField(row, field, v)}
      onCommit={() => m.commit(row)}
    />
  ) : (
    // date / url keep a real input: the native pickers and validation matter
    // more there than wrapping does.
    <input
      type={type}
      value={m.getDraft(row)[field]}
      onChange={(e) => m.editField(row, field, e.target.value)}
      onBlur={() => m.commit(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={inputCls}
    />
  );
}

export function ApplicationsTableEditable({ rows, resumes, onPatched, onDeleted }: Props) {
  const [drafts, setDrafts] = React.useState<Record<string, EditableRow>>({});
  // Default to the pipeline, not to whatever the server returned. The server
  // orders by applied date; clicking any header switches to that column.
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "status", desc: false },
  ]);
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

  const ch = createColumnHelper<Application>();
  const columns = React.useMemo(
    () => [
      ch.accessor("company", {
        header: "Company",
        cell: ({ row, table }) => textCell(table, row.original, "company"),
        meta: { className: "min-w-[7rem]" },
      }),
      // Widths are hints, not a fixed layout: the date input has an intrinsic
      // size that a table-fixed percentage was clipping.
      ch.accessor("title", {
        header: "Title",
        // Hovering the title says which résumé went out — the thing you want to
        // know when a recruiter calls back and you have to remember what they read.
        cell: ({ row, table }) => (
          <div
            title={
              row.original.resumeVersion
                ? `Résumé sent: ${row.original.resumeVersion}`
                : "No résumé recorded"
            }
          >
            {textCell(table, row.original, "title")}
          </div>
        ),
        meta: { className: "w-[22%] min-w-[10rem]" },
      }),
      ch.accessor("status", {
        header: "Status",
        // Pipeline order, not alphabetical: A-Z would put GHOSTED between
        // APPLIED and INTERVIEW.
        sortingFn: (a, b) => statusRank(a.original.status) - statusRank(b.original.status),
        meta: { className: "min-w-[7rem]" },
        cell: ({ row, table }) => {
          const m = table.options.meta as EditorMeta;
          return (
          <select
            value={m.getDraft(row.original).status}
            onChange={(e) => {
              m.editField(row.original, "status", e.target.value);
              // commit immediately after state settles
              setTimeout(() => m.commit(row.original), 0);
            }}
            className={inputCls}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          );
        },
      }),
      ch.accessor((r) => (r.appliedDate ? String(r.appliedDate) : ""), {
        id: "appliedDate",
        header: "Applied",
        cell: ({ row, table }) => textCell(table, row.original, "appliedDate", "date"),
      }),
      ch.accessor("location", {
        header: "Location",
        cell: ({ row, table }) => textCell(table, row.original, "location"),
        meta: { className: "w-[13%] min-w-[7rem]" },
      }),
      ch.accessor("resumeVersion", {
        header: "Résumé",
        meta: { className: "min-w-[6.5rem]" },
        cell: ({ row, table }) => {
          const m = table.options.meta as EditorMeta;
          if (m.resumes.length === 0) return null;
          return (
            <select
              value={m.getDraft(row.original).resumeVersion}
              onChange={(e) => {
                m.editField(row.original, "resumeVersion", e.target.value);
                setTimeout(() => m.commit(row.original), 0);
              }}
              className={inputCls}
            >
              <option value="">—</option>
              {m.resumes.map((r) => (
                <option key={r.id} value={r.id} title={r.label}>
                  {r.id}
                </option>
              ))}
            </select>
          );
        },
      }),
      ch.accessor("salary", {
        header: "Salary",
        cell: ({ row, table }) => textCell(table, row.original, "salary"),
        meta: { className: "w-[15%] min-w-[8rem]" },
      }),
      // Editable, not just a link: a row added from pasted text has no URL yet,
      // and there was previously no way to add one after the fact.
      ch.display({
        id: "url",
        header: "Link",
        // Needs a floor: the column would otherwise size to the word "Link" and
        // squeeze the input down to a few unclickable pixels next to "open".
        meta: { className: "w-[12%] min-w-[8rem]" },
        cell: ({ row, table }) => (
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">{textCell(table, row.original, "url", "url")}</div>
            {row.original.url && (
              <a
                href={row.original.url}
                target="_blank"
                rel="noreferrer"
                title={row.original.url}
                className="shrink-0 pr-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                open
              </a>
            )}
          </div>
        ),
      }),
      ch.accessor("notes", {
        header: "Notes",
        enableSorting: false,
        cell: ({ row, table }) => textCell(table, row.original, "notes"),
        meta: { className: "w-[13%] min-w-[6rem]" },
      }),
      ch.display({
        id: "actions",
        header: "",
        cell: ({ row, table }) => (
          <button
            onClick={() => (table.options.meta as EditorMeta).remove(row.original)}
            className="px-2 text-xs text-muted-foreground hover:text-destructive"
            aria-label="Delete row"
          >
            Delete
          </button>
        ),
      }),
    ],
    // No dependencies on purpose. A columns array that changes identity makes
    // TanStack rebuild every cell, which unmounts the focused input — that is
    // why typing used to lose focus after one character and never commit. Cells
    // read the live handlers off table.options.meta instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: { resumes, getDraft, editField, commit, remove } satisfies EditorMeta,
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
