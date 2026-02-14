"use client";

import { useEffect, useState, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { ScrapeStatus } from "@/lib/types";
import Link from "next/link";

interface ScrapeStatusProps {
  isPolling: boolean;
  onStatusChange: (status: ScrapeStatus) => void;
}

export function ScrapeStatusDisplay({
  isPolling,
  onStatusChange,
}: ScrapeStatusProps) {
  const [status, setStatus] = useState<ScrapeStatus | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/scrape/status");
      const data: ScrapeStatus = await res.json();
      setStatus(data);
      onStatusChange(data);
    } catch {
      // Silently retry on next interval
    }
  }, [onStatusChange]);

  useEffect(() => {
    if (!isPolling) return;

    // Poll immediately, then every 3 seconds
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [isPolling, poll]);

  if (!status) return null;

  if (status.running) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <Spinner />
        <div>
          <p className="text-sm font-medium">Scraping in progress...</p>
          {status.outputFile && (
            <p className="text-xs text-muted-foreground">
              Writing to {status.outputFile}
            </p>
          )}
          {status.startedAt && (
            <p className="text-xs text-muted-foreground">
              Started {new Date(status.startedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status.error) {
    return (
      <div className="rounded-lg border border-destructive bg-card p-4">
        <p className="text-sm font-medium text-destructive">
          Scrape failed
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {status.error}
        </p>
      </div>
    );
  }

  if (status.outputFile) {
    return (
      <div className="rounded-lg border border-green-800 bg-card p-4">
        <p className="text-sm font-medium text-green-400">Scrape complete</p>
        <p className="text-xs text-muted-foreground mt-1">
          Saved to {status.outputFile}
        </p>
        <Link
          href={`/results?file=${encodeURIComponent(status.outputFile)}`}
          className="text-xs text-primary hover:underline mt-2 inline-block"
        >
          View results
        </Link>
      </div>
    );
  }

  return null;
}
