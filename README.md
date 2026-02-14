# ClaudeYacht

A YachtWorld sailboat listing scraper with a Next.js web frontend for browsing, filtering, and annotating results.

Scrapes used sailboat listings from YachtWorld using Playwright with stealth plugins to bypass Cloudflare detection. Results are stored in a local SQLite database and presented in a filterable, sortable table with annotation tools for evaluating boats.

## Features

- **Web-based scraper control** -- Configure search parameters (price range, length, condition) and launch scrapes from the browser
- **Filterable results table** -- Sort by any column, resize columns, expand rows for details
- **Tri-state filters** -- Include or exclude specific manufacturers and states; range sliders for price, length, and build year
- **Annotations** -- Thumbs up/down, favorites, free-text notes, and property checkboxes (double-ender, tiller steering, furling main, etc.)
- **Search** -- Full-text search across listing name, seller, location, manufacturer, state, and notes
- **Indicator icons** -- At-a-glance icons on each row for favorites, thumbs, notes, and flagged properties
- **Light/dark mode** -- System-aware theme toggle with manual override
- **Cloudflare bypass** -- Persistent browser profile retains session cookies across scrapes

<!-- Screenshots: add images here -->
<!-- ![Results Table](docs/screenshots/results.png) -->
<!-- ![Scrape Page](docs/screenshots/scrape.png) -->

## Prerequisites

- **Node.js** >= 18
- **npm**
- A display environment (the scraper runs a visible browser window by default)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/ClaudeYacht.git
cd ClaudeYacht

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Initialize the database
npx prisma db push

# Start the dev server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Environment Setup

No environment variables are required. The app uses sensible defaults:

| Setting | Default | Location |
|---|---|---|
| Database | `data/yacht.db` (SQLite) | `prisma.config.ts` |
| Scrape output | `data/*.jsonl` | `lib/data-dir.ts` |
| Browser profile | `.browser-profile/` | `scripts/scrape_yachtworld.js` |
| Dev server port | 3000 | Next.js default |

The `data/` directory is created automatically on first use and is gitignored.

## Usage

### Running a scrape from the UI

1. Navigate to **Scrape** in the top nav
2. Set price range, length range, and condition
3. Toggle exclusions (ketch/yawl, multihull) as desired
4. Click **Start Scrape**
5. Monitor progress in the status panel -- results auto-ingest on completion

### Running a scrape from the CLI

```bash
# With defaults (used sailboats, $10k-$100k, 37-42ft)
node scripts/scrape_yachtworld.js

# With custom parameters
node scripts/scrape_yachtworld.js \
  --priceMin 20000 \
  --priceMax 80000 \
  --lengthMinFt 35 \
  --lengthMaxFt 45 \
  --condition used \
  --excludeKetchYawl true \
  --excludeMultihull true \
  --outputFile data/custom_scrape.jsonl
```

After a CLI scrape, ingest the results via the Scrape page or by running:

```bash
node scripts/ingest-initial.js
```

### Browsing results

Navigate to **Results** to view ingested listings. Use the filter icon to open the filter rail, where you can:

- **Include/exclude** manufacturers or states (click to cycle: neutral -> include -> exclude)
- **Adjust range sliders** for price, length, and build year
- **Toggle** favorites-only or hide thumbs-down listings
- **Search** by any text field

Click a row to expand it and access annotations: thumbs up/down, favorite star, property checkboxes, and a notes field.

### Database management

- **Clear all listings**: Use the "Clear All Listings" button on the Scrape page
- **Browse raw data**: Run `npx prisma studio` to open the database GUI
- **Schema changes**: Edit `prisma/schema.prisma`, then run `npx prisma db push`

## How It Works

### Scraping pipeline

The scraper uses [playwright-extra](https://github.com/nicedayfor/playwright-extra) with [puppeteer-extra-plugin-stealth](https://github.com/nicedayfor/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) to avoid bot detection. It opens a persistent browser context (stored in `.browser-profile/`) to retain Cloudflare cookies across sessions, then paginates through search results extracting listing data from `data-ssr-meta` attributes.

### Ingestion

JSONL files are parsed line by line. Each listing's build year is extracted from the listing name (e.g., "2006 Hunter 38" -> year: 2006, name: "Hunter 38"). Listings are deduplicated by their unique YachtWorld URL. The ingestion runs automatically after each successful scrape.

### Client-side filtering

All filtering and sorting happens in the browser using pure functions in `lib/filters.ts`. The dataset is small enough that server-side filtering isn't needed. Filter facets are cross-filtered: each dimension's available options are computed by applying all other filters except its own, so active filters don't hide their own options.

### Annotations

Notes, thumbs up/down, favorites, and property checkboxes are saved to the database via optimistic updates. The UI updates immediately and reverts if the server request fails.

## Project Structure

```
app/                    # Next.js App Router (pages + API routes)
  api/                  # REST endpoints for scrape, ingest, listings
  results/              # Results page with filters, search, table
  scrape/               # Scrape configuration page
components/             # React components
  ui/                   # Radix-based primitives (button, slider, switch, etc.)
lib/                    # Business logic (types, filters, ingest, scraper, utils)
scripts/                # Standalone scraper (CommonJS, runs as child process)
prisma/                 # Database schema
data/                   # Gitignored: JSONL files + SQLite database
```

## Built With

- [Next.js 15](https://nextjs.org/) + [React 19](https://react.dev/)
- [Prisma 6](https://www.prisma.io/) (SQLite)
- [Playwright](https://playwright.dev/) + stealth plugins
- [TanStack Table](https://tanstack.com/table)
- [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)

## License

ISC
