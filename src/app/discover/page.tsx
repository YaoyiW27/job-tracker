import { DiscoverTable } from "@/components/discover/discover-table";

export default function DiscoverPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-sm text-muted-foreground">
          Ranked postings from the ingested feeds — one way to fill your tracker.
        </p>
      </div>
      <DiscoverTable />
    </main>
  );
}
