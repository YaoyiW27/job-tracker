export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Job Tracker</h1>
      <p className="text-muted-foreground">
        Personal job-search app — Discover + Track. Scaffold is live (P0a).
      </p>
      <ul className="text-sm text-muted-foreground">
        <li>Next up: port location tagging (P0b), ingest (P0c), Discover table (P0d).</li>
      </ul>
    </main>
  );
}
