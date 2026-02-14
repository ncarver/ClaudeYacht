# Project Structure

## Directory Layout

```
app/                        # Next.js App Router
  api/
    ingest/route.ts         # POST — ingest JSONL file into DB
    listings/route.ts       # DELETE — clear all listings
    listings/[id]/route.ts  # PATCH — update annotations (notes, thumbs, favorite, properties)
    results/route.ts        # GET — fetch all listings from DB
    scrape/route.ts         # POST — start scrape, GET — list JSONL files
    scrape/status/route.ts  # GET — poll scrape status
  results/
    page.tsx                # Server component with Suspense boundary
    results-content.tsx     # Client component: orchestrates filters, search, table
  scrape/page.tsx           # Scrape config form + status display + clear DB
  layout.tsx                # Root layout with ThemeProvider, nav
  page.tsx                  # Home page with nav links
  globals.css               # CSS variables for light/dark theme

components/                 # React components
  ui/                       # Radix-based primitives (button, checkbox, input, label, select, sheet, slider, spinner, switch)
  file-picker.tsx           # JSONL file selector dropdown
  listing-detail.tsx        # Expanded row: seller info, thumbs, star, property checkboxes, notes
  nav.tsx                   # Top nav bar with route links + theme toggle
  results-filters.tsx       # Left filter rail: tri-state checkboxes, range sliders, toggles
  results-search.tsx        # Search input bar
  results-table.tsx         # TanStack React Table with expandable rows, indicators, pagination
  scrape-form.tsx           # Scrape parameter form (price, length, condition, exclusions)
  scrape-status.tsx         # Polling status display for active scrapes
  theme-toggle.tsx          # System/light/dark mode cycle button

lib/                        # Shared business logic
  build-url.ts              # Constructs YachtWorld search URL from ScrapeParams
  data-dir.ts               # Resolves data/ directory, lists JSONL files
  filters.ts                # matchesSearch, matchesFilters, matchesFiltersExcept, getUniqueValues, getNumericRange
  ingest.ts                 # Parses JSONL, extracts buildYear, upserts into Prisma
  prisma.ts                 # PrismaClient singleton (globalThis for HMR)
  read-jsonl.ts             # Line-by-line JSONL parser
  scraper.ts                # Spawns scraper child process, tracks state, auto-ingests on completion
  types.ts                  # All TypeScript interfaces: Listing, Filters, TriStateFilter, BoatProperties, ScrapeParams, etc.
  utils.ts                  # cn(), metersToFeet(), formatPrice(), formatLength()

prisma/
  schema.prisma             # Listing model definition (SQLite)

scripts/
  scrape_yachtworld.js      # Playwright scraper (CommonJS, runs as child process)
  ingest-initial.js         # One-off script to ingest existing JSONL files

data/                       # gitignored — JSONL files + yacht.db
.browser-profile/           # gitignored — persistent Chromium profile for Cloudflare bypass
```

## Database

- SQLite at `data/yacht.db` via Prisma ORM
- Schema: `prisma/schema.prisma`
- `Listing` model fields: id, linkUrl (unique), buildYear, listingName, sellerName, sellerLocation, imgUrl, manufacturer, boatClass, lengthInMeters, state, priceUSD, dateLoaded, fileSource, notes, thumbs, favorite, properties
- `properties` is a JSON string column (`@default("{}")`) storing `BoatProperties` (see `lib/types.ts:19-47`)
- `buildYear` is parsed during ingest from listing names like "2006 Hunter 38" (see `lib/ingest.ts:6-15`)
