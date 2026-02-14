# CLAUDE.md

## Project Overview

YachtWorld sailboat listing scraper with a Next.js web frontend. Scrapes used sailboat listings via Playwright (with Cloudflare stealth bypass), ingests results into SQLite (Prisma), and provides a filterable/sortable table UI for browsing and annotating listings.

## Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Dev server at http://localhost:3000
npm run build                  # Production build (use to verify changes)
npx prisma db push             # Sync schema changes to SQLite
npx prisma studio              # GUI database browser
node scripts/scrape_yachtworld.js  # Run scraper standalone (defaults: used, $10k-$100k, 37-42ft)
```

No linter or test suite configured. Use `npm run build` to verify TypeScript correctness.

## Data Flow

```
Scraper (scripts/scrape_yachtworld.js)
  → JSONL file (data/*.jsonl)
  → Auto-ingest (lib/ingest.ts)
  → SQLite DB (data/yacht.db via Prisma)
  → GET /api/results → client-side filtering/sorting
  → PATCH /api/listings/[id] → annotations persist back to DB
```

## Key Directories

| Directory | Purpose |
|---|---|
| `app/` | Next.js App Router — pages and API routes |
| `components/` | React components (feature + `ui/` primitives) |
| `lib/` | Business logic: types, filters, ingest, scraper, utilities |
| `scripts/` | Standalone CommonJS scraper (child process, not imported by Next.js) |
| `prisma/` | Schema definition (`schema.prisma`) |
| `data/` | Gitignored — JSONL files and `yacht.db` |
| `.browser-profile/` | Gitignored — persistent Chromium profile for Cloudflare session |

## API Routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/scrape` | Start a scrape (409 if already running) |
| GET | `/api/scrape` | List available JSONL files |
| GET | `/api/scrape/status` | Poll current scrape status |
| POST | `/api/ingest` | Ingest a JSONL file into the database |
| GET | `/api/results` | Fetch all listings |
| PATCH | `/api/listings/[id]` | Update annotations (notes, thumbs, favorite, properties) |
| DELETE | `/api/listings` | Clear all listings |

## Critical Files

- `lib/types.ts` — All shared TypeScript interfaces (`Listing`, `Filters`, `TriStateFilter`, `BoatProperties`, `ScrapeParams`)
- `lib/filters.ts` — Search and filter logic (`matchesSearch`, `matchesFilters`, `matchesFiltersExcept`)
- `lib/scraper.ts` — Spawns scraper child process, manages state via `globalThis`, auto-ingests on completion
- `lib/prisma.ts` — PrismaClient singleton (persisted via `globalThis` for HMR)
- `prisma/schema.prisma` — `Listing` model: run `npx prisma db push` after changes
- `components/results-table.tsx` — TanStack React Table with expandable rows, indicator icons, pagination
- `components/results-filters.tsx` — Filter rail: tri-state checkboxes, range sliders, toggles
- `components/listing-detail.tsx` — Expanded row: seller info, thumbs, favorites, property checkboxes, notes
- `app/results/results-content.tsx` — Orchestrates filters, search, table; handles optimistic updates
- `scripts/scrape_yachtworld.js` — Playwright scraper (CommonJS); do not import from Next.js

## Important Conventions

- **Schema changes**: Edit `prisma/schema.prisma`, then run `npx prisma db push` — no formal migrations
- **`properties` column**: JSON string storing `BoatProperties` — parse with `parseProperties()` from `lib/types.ts:58`
- **Scraper isolation**: Lives in `scripts/` as CommonJS; runs as child process via `lib/scraper.ts`
- **Client-side filtering**: All filter logic runs in the browser (`lib/filters.ts`); dataset is small enough
- **Optimistic updates**: `results-content.tsx` updates state immediately, reverts on PATCH failure
- **PATCH whitelist**: Only `notes`, `thumbs`, `favorite`, `properties` accepted (`app/api/listings/[id]/route.ts:15`)
- **Theming**: CSS variables in `app/globals.css` with `@theme inline`; toggled by `next-themes` via class attribute

## Additional Documentation

Check these files for detailed reference when working in related areas:

- `.claude/docs/project_structure.md` — Full directory layout with file-by-file descriptions
- `.claude/docs/tech_stack.md` — Framework versions, UI libraries, configuration files
- `.claude/docs/architectural_patterns.md` — Design patterns used across the codebase (globalThis singletons, optimistic updates, tri-state filters, cross-filtered facets, push sidebar, JSON-in-SQLite, etc.)
