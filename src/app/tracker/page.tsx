import { listApplications } from "@/lib/applications";
import { loadScoreContext } from "@/lib/scorer";
import { TrackerClient } from "@/components/tracker/tracker-client";

// Always render fresh so a full reload reflects the latest data.
export const dynamic = "force-dynamic";

/**
 * Résumé variants for the "which one did I send" control. Same source as the
 * scorer, so the ids match what /match recommends. Absent context (no .private/,
 * no env vars) just means the control offers nothing — the tracker still works.
 */
function resumeOptions(): { id: string; label: string }[] {
  try {
    return loadScoreContext().variants.map((v) => ({ id: v.id, label: v.label }));
  } catch {
    return [];
  }
}

export default async function TrackerPage() {
  const apps = await listApplications();

  // Same width as Discover: the tracker has more columns, and max-w-5xl forced
  // a horizontal scrollbar you had to drag just to reach Delete.
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <TrackerClient initial={apps} resumes={resumeOptions()} />
    </main>
  );
}
