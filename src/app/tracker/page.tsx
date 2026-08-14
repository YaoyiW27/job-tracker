import { listApplications } from "@/lib/applications";
import { TrackerClient } from "@/components/tracker/tracker-client";

// Always render fresh so a full reload reflects the latest data.
export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const apps = await listApplications();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TrackerClient initial={apps} />
    </main>
  );
}
