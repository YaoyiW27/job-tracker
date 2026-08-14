import type { Application } from "@prisma/client";

const STATUS_STYLE: Record<string, string> = {
  SAVED: "bg-muted text-muted-foreground",
  APPLIED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  OA: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  INTERVIEW: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  OFFER: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  GHOSTED: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
};

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export function ApplicationsTable({ apps }: { apps: Application[] }) {
  if (apps.length === 0) {
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
          <tr>
            <th className="px-3 py-2 font-medium">Company</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Applied</th>
            <th className="px-3 py-2 font-medium">Salary</th>
            <th className="px-3 py-2 font-medium">Link</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">{a.company}</td>
              <td className="px-3 py-2">{a.title}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLE[a.status] ?? STATUS_STYLE.SAVED
                  }`}
                >
                  {a.status}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{fmtDate(a.appliedDate)}</td>
              <td className="px-3 py-2 text-muted-foreground">{a.salary ?? "—"}</td>
              <td className="px-3 py-2">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    open
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
