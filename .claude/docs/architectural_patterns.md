# Architectural Patterns

## 1. GlobalThis Singleton for HMR Persistence

Both the Prisma client and the scraper state use `globalThis` to persist instances across Next.js hot module reloads in development. This prevents connection exhaustion (Prisma) and lost state (scraper).

- `lib/prisma.ts:5-11` — `globalThis.prisma` holds the PrismaClient
- `lib/scraper.ts:24-34` — `globalThis.scrapeState` holds the ScrapeState

Pattern: declare global var, check on access, create if missing, assign back to globalThis.

## 2. Optimistic UI Updates with Server Rollback

The results page updates local state immediately on user action, then persists to the server. On failure, it reverts by re-fetching.

- `app/results/results-content.tsx:54-71` — `handleUpdateListing` sets state optimistically, then fires PATCH request; catch block calls `fetchListings()` to revert

This avoids perceived latency for annotations (notes, thumbs, favorites, properties).

## 3. Client-Side Filtering with Cross-Filtered Facets

All filtering happens client-side since the dataset is small enough. For faceted filters (manufacturer, state), cross-filtering is used: each dimension's available options are computed by applying all OTHER filters except its own, so an active filter doesn't hide its own options.

- `components/results-filters.tsx:206-256` — `forManufacturers`, `forStates`, etc. each call `matchesFiltersExcept()` with different exclusion dimensions
- `lib/filters.ts:98-163` — `matchesFiltersExcept(listing, filters, excludeDimension)` applies all filters except the named one

## 4. Tri-State Filter Pattern

Manufacturer and State filters support three states per value: neutral, include (whitelist), exclude (blacklist). This uses a `TriStateFilter` type with separate include/exclude arrays.

- `lib/types.ts:67-70` — `TriStateFilter { include: string[], exclude: string[] }`
- `lib/filters.ts:18-31` — `matchesTriState()`: include acts as whitelist (only matching pass), exclude acts as blacklist (matching blocked)
- `components/results-filters.tsx:182-202` — `cycleTriState()`: neutral → include → exclude → neutral

## 5. Child Process Scraper with Auto-Ingest

The scraper runs as a spawned Node.js child process (CommonJS) rather than being imported into Next.js. This isolates Playwright's heavy dependencies. On successful exit, results are automatically ingested.

- `lib/scraper.ts:46-129` — `startScrape()` spawns process, captures stdout/stderr
- `lib/scraper.ts:104-119` — `child.on("exit")` triggers `ingestFile()` on success
- `scripts/scrape_yachtworld.js` — Standalone CommonJS script (not part of Next.js bundle)

## 6. JSON-in-SQLite for Flexible Properties

Boat property checkboxes (double-ender, tiller steering, etc.) are stored as a JSON string in a SQLite text column rather than adding individual columns. This allows easy extension without migrations.

- `prisma/schema.prisma:18` — `properties String @default("{}")`
- `lib/types.ts:19-47` — `BoatProperties` interface, `defaultBoatProperties`, `boatPropertyLabels`
- `lib/types.ts:58-63` — `parseProperties()` merges defaults with parsed JSON (handles missing/corrupt data)

## 7. Whitelist-Based PATCH Endpoint

The listing update API validates incoming fields against an explicit allowlist to prevent arbitrary column updates.

- `app/api/listings/[id]/route.ts:15` — `allowedFields = ["notes", "thumbs", "favorite", "properties"]`
- Only fields present in both the request body AND the allowlist are written

## 8. Push Sidebar (Not Overlay)

The filter rail uses CSS width transition to push main content rather than overlaying it (like a Sheet). This keeps table content visible and interactive when filters are open.

- `app/results/results-content.tsx` — Filter container uses `w-64` with `transition-all duration-300 ease-in-out`, toggling between `w-64 opacity-100` and `w-0 opacity-0`

## 9. Central Type Definitions

All TypeScript interfaces and type constants live in a single file (`lib/types.ts`). Components and API routes import from this single source of truth.

Key types: `Listing`, `Filters`, `TriStateFilter`, `BoatProperties`, `ScrapeParams`, `ScrapeStatus`, `ScrapeFileInfo`, `RawListing`, `IngestResult`

## 10. Radix UI Primitives with CVA Variants

UI components in `components/ui/` wrap Radix primitives with Tailwind styling using `class-variance-authority` for variant management. They follow a consistent pattern:

- ForwardRef-based components
- `cn()` utility for class merging (`lib/utils.ts:4`)
- Variant props via `cva()` (see `components/ui/button.tsx`)
- Re-export Radix sub-components for convenience
