import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-20">
      <h1 className="text-4xl font-bold">ClaudeYacht</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Scrape YachtWorld sailboat listings and browse results with filters and
        sorting.
      </p>
      <div className="flex gap-4">
        <Link
          href="/scrape"
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Start Scraping
        </Link>
        <Link
          href="/results"
          className="rounded-lg border border-border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          View Results
        </Link>
      </div>
    </div>
  );
}
