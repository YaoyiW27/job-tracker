import { listApplications } from "@/lib/applications";
import { computeDashboardMetrics } from "@/lib/dashboard";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";

export const dynamic = "force-dynamic";

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-3xl font-semibold tabular-nums"
        style={accent ? { color: "var(--chart-good)" } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const apps = await listApplications();
  const m = computeDashboardMetrics(
    apps.map((a) => ({ status: a.status, company: a.company, appliedDate: a.appliedDate })),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {m.total} tracked · {m.applied} applied
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Applied" value={m.applied} />
        <Kpi label="In progress" value={m.inProgress} />
        <Kpi label="Response rate" value={`${Math.round(m.responseRate * 100)}%`} />
        <Kpi label="Offers" value={m.offers} accent={m.offers > 0} />
      </div>

      {m.total === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing to chart yet. Add applications in the Tracker to see your funnel and trends.
        </div>
      ) : (
        <DashboardCharts metrics={m} />
      )}
    </main>
  );
}
