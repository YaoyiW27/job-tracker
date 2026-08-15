"use client";

import * as React from "react";
import type { Job } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveToTrackerButton } from "./save-to-tracker-button";
import { LOCATION_FIT, ROLE_KIND } from "@/lib/enums";
import { recencyTier } from "@/lib/recency";

const RECENCY_STYLE: Record<string, string> = {
  "<24h": "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  "<3d": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "<1w": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "<2w": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  older: "bg-muted text-muted-foreground",
  "—": "bg-muted text-muted-foreground",
};

const BUCKET_LABEL: Record<string, string> = {
  VANCOUVER: "Vancouver",
  CANADA_REMOTE: "Canada · remote",
  REMOTE_GENERIC: "Remote (verify)",
  CANADA_OTHER: "Canada · other",
  US_REMOTE: "US · remote",
  US_ONSITE: "US · on-site",
  OTHER: "Other",
};

const PAGE_SIZE = 50;

function parseLocations(json: string): string {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join(" · ") : String(json);
  } catch {
    return json;
  }
}

function ageDays(datePosted: string | null): string {
  if (!datePosted) return "—";
  const d = new Date(datePosted);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "today" : `${days}d`;
}

const emptyFilters = {
  bucket: "",
  role: "",
  company: "",
  category: "",
  minFit: "",
  active: true,
  inScope: false,
};

export function DiscoverTable() {
  const [filters, setFilters] = React.useState({ ...emptyFilters });
  const [sort, setSort] = React.useState<"fit" | "newest">("fit");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{ jobs: Job[]; total: number }>({ jobs: [], total: 0 });
  const [loading, setLoading] = React.useState(false);

  function update<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function changeSort(next: "fit" | "newest") {
    setSort(next);
    setPage(1);
  }

  React.useEffect(() => {
    const p = new URLSearchParams();
    if (filters.bucket) p.set("bucket", filters.bucket);
    if (filters.role) p.set("role", filters.role);
    if (filters.company.trim()) p.set("company", filters.company.trim());
    if (filters.category.trim()) p.set("category", filters.category.trim());
    if (filters.minFit) p.set("minFit", filters.minFit);
    if (!filters.active) p.set("active", "all");
    if (filters.inScope) p.set("inScope", "1");
    p.set("sort", sort);
    p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/jobs?${p.toString()}`, { signal: ctrl.signal });
        if (res.ok) setData(await res.json());
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [filters, sort, page]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const selectCls =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filters.bucket} onChange={(e) => update("bucket", e.target.value)} className={selectCls}>
          <option value="">All buckets</option>
          {Object.keys(LOCATION_FIT).map((b) => (
            <option key={b} value={b}>
              {BUCKET_LABEL[b] ?? b}
            </option>
          ))}
        </select>
        <select value={filters.role} onChange={(e) => update("role", e.target.value)} className={selectCls}>
          <option value="">New grad + intern</option>
          {Object.keys(ROLE_KIND).map((r) => (
            <option key={r} value={r}>
              {r === "NEW_GRAD" ? "New grad" : "Intern"}
            </option>
          ))}
        </select>
        <Input
          placeholder="Company…"
          value={filters.company}
          onChange={(e) => update("company", e.target.value)}
          className="h-9 w-40"
        />
        <Input
          placeholder="Category…"
          value={filters.category}
          onChange={(e) => update("category", e.target.value)}
          className="h-9 w-36"
        />
        <Input
          type="number"
          placeholder="Min fit"
          value={filters.minFit}
          onChange={(e) => update("minFit", e.target.value)}
          className="h-9 w-24"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={filters.active} onChange={(e) => update("active", e.target.checked)} />
          Active only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={filters.inScope} onChange={(e) => update("inScope", e.target.checked)} />
          In-scope only
        </label>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{loading ? "Loading…" : `${data.total.toLocaleString()} jobs`}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs">Sort:</span>
            <div className="flex rounded-md border p-0.5">
              <Button size="sm" variant={sort === "fit" ? "default" : "ghost"} onClick={() => changeSort("fit")}>
                Fit
              </Button>
              <Button size="sm" variant={sort === "newest" ? "default" : "ghost"} onClick={() => changeSort("newest")}>
                Newest
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Bucket</th>
              <th className="px-3 py-2 font-medium">Fit</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Fresh</th>
              <th className="px-3 py-2 font-medium">Salary</th>
              <th className="px-3 py-2 font-medium">Flags</th>
              <th className="px-3 py-2 font-medium">Apply</th>
              <th className="px-3 py-2 font-medium">Save</th>
            </tr>
          </thead>
          <tbody>
            {data.jobs.map((j) => (
              <tr key={j.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {BUCKET_LABEL[j.locationFit] ?? j.locationFit}
                </td>
                <td className="px-3 py-2 tabular-nums" title={j.fitReason ?? ""}>
                  {j.fitScore ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {j.topTier && <span title="top-tier">★ </span>}
                  {j.company}
                </td>
                <td className="px-3 py-2">{j.title}</td>
                <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground" title={parseLocations(j.locations)}>
                  {parseLocations(j.locations)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {(() => {
                    const { tier } = recencyTier(j.datePosted as unknown as string);
                    return (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RECENCY_STYLE[tier] ?? RECENCY_STYLE["—"]}`}
                        title={ageDays(j.datePosted as unknown as string)}
                      >
                        {tier}
                      </span>
                    );
                  })()}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{j.salary ?? "—"}</td>
                <td className="max-w-[200px] px-3 py-2 text-xs text-amber-700 dark:text-amber-500" title={j.authFlag ?? ""}>
                  {j.authFlag ? j.authFlag.split(";")[0] : ""}
                </td>
                <td className="px-3 py-2">
                  {j.url && !j.url.startsWith("urn:") ? (
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                      open
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <SaveToTrackerButton job={j} />
                </td>
              </tr>
            ))}
            {data.jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                  No jobs match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
