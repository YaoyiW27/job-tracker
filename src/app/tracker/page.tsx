import { listApplications } from "@/lib/applications";
import { AddRowDialog } from "@/components/tracker/add-row-dialog";
import { ApplicationsTable } from "@/components/tracker/applications-table";

// Always render fresh so router.refresh() after adding a row shows it.
export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const apps = await listApplications();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tracker</h1>
          <p className="text-sm text-muted-foreground">
            {apps.length} {apps.length === 1 ? "application" : "applications"}
          </p>
        </div>
        <AddRowDialog />
      </div>
      <ApplicationsTable apps={apps} />
    </main>
  );
}
