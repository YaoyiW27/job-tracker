import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-7xl items-center gap-5 px-6 py-3">
        <span className="font-semibold tracking-tight">Job Tracker</span>
        <Link href="/tracker" className="text-sm text-muted-foreground hover:text-foreground">
          Tracker
        </Link>
        <Link href="/discover" className="text-sm text-muted-foreground hover:text-foreground">
          Discover
        </Link>
      </nav>
    </header>
  );
}
