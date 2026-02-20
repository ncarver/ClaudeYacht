"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { SortingState } from "@tanstack/react-table";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterRail } from "@/components/results-filters";
import { ResultsSearch } from "@/components/results-search";
import { ResultsTable } from "@/components/results-table";
import { ResearchPanel } from "@/components/research-panel";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Listing, Filters } from "@/lib/types";
import {
  matchesSearch,
  matchesFilters,
  defaultFilters,
  hasActiveFilters,
} from "@/lib/filters";
import Link from "next/link";

export function ResultsPageContent() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/search/sort state
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [researchListing, setResearchListing] = useState<Listing | null>(null);

  // Fetch listings from DB
  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/results");
      if (!res.ok) throw new Error("Failed to load results");
      const data: Listing[] = await res.json();
      setListings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load listings from DB on mount
  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Optimistic update for annotations
  function handleUpdateListing(
    id: number,
    data: Partial<Pick<Listing, "notes" | "thumbs" | "favorite" | "properties">>
  ) {
    // Optimistic update
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...data } : l))
    );

    // Persist to server
    fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {
      // Revert on failure by re-fetching
      fetchListings();
    });
  }

  const filteredListings = useMemo(() => {
    return listings
      .filter((l) => matchesSearch(l, search))
      .filter((l) => matchesFilters(l, filters));
  }, [listings, search, filters]);

  const filtersActive = hasActiveFilters(filters);

  if (loading && listings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!loading && listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">No scrape results found.</p>
        <Link
          href="/scrape"
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:opacity-90 transition-opacity"
        >
          Run a scrape
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive bg-card p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Toolbar: filter button + search + count */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 relative"
          onClick={() => setFilterOpen((o) => !o)}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
          {filtersActive && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>

        <div className="flex-1">
          <ResultsSearch value={search} onChange={setSearch} />
        </div>
        <p className="text-sm text-muted-foreground shrink-0">
          {filteredListings.length} of {listings.length} listings
        </p>
      </div>

      <div className="flex gap-4">
        {/* Push sidebar */}
        <div
          className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
            filterOpen ? "w-64 opacity-100" : "w-0 opacity-0"
          }`}
        >
          <div className="w-64">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Filters</h2>
              <button
                onClick={() => setFilterOpen(false)}
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <FilterRail
              filters={filters}
              onChange={setFilters}
              listings={listings}
            />
          </div>
        </div>

        {/* Table */}
        <div className="min-w-0 flex-1">
          <ResultsTable
            data={filteredListings}
            sorting={sorting}
            onSortingChange={setSorting}
            onUpdateListing={handleUpdateListing}
            onResearch={(listing) => setResearchListing(listing)}
          />
        </div>
      </div>

      {/* Research panel */}
      <Sheet
        open={!!researchListing}
        onOpenChange={(open) => !open && setResearchListing(null)}
      >
        <SheetContent side="right" className="w-120 sm:w-135">
          <SheetTitle className="sr-only">Research</SheetTitle>
          <SheetDescription className="sr-only">
            Research data for this listing
          </SheetDescription>
          {researchListing && (
            <ResearchPanel
              listing={researchListing}
              onClose={() => setResearchListing(null)}
              onResearchComplete={fetchListings}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
