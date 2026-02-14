"use client";

import { useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { ScrapeForm } from "@/components/scrape-form";
import { ScrapeStatusDisplay } from "@/components/scrape-status";
import { Button } from "@/components/ui/button";
import type { ScrapeParams, ScrapeStatus } from "@/lib/types";

export default function ScrapePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = useCallback((status: ScrapeStatus) => {
    if (!status.running) {
      setIsRunning(false);
      setIsPolling(false);
    }
  }, []);

  async function handleClearDatabase() {
    if (
      !window.confirm(
        "Are you sure you want to delete all listings from the database? This cannot be undone."
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/listings", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear database");
      const data = await res.json();
      alert(`Deleted ${data.deleted} listings.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear database");
    }
  }

  async function handleSubmit(params: ScrapeParams) {
    setError(null);
    setIsRunning(true);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start scrape");
      }

      setIsPolling(true);
    } catch (err) {
      setIsRunning(false);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Scrape YachtWorld</h1>
        <p className="text-muted-foreground mt-1">
          Configure search parameters and start a new scrape.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <ScrapeForm onSubmit={handleSubmit} disabled={isRunning} />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-card p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <ScrapeStatusDisplay
        isPolling={isPolling}
        onStatusChange={handleStatusChange}
      />

      <div className="border-t border-border pt-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          Database
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive hover:text-white"
          onClick={handleClearDatabase}
          disabled={isRunning}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All Listings
        </Button>
      </div>
    </div>
  );
}
