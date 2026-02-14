# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YachtWorld sailboat listing scraper with a Next.js web frontend. The scraper uses Playwright with stealth plugins to bypass Cloudflare detection. Scrape results are ingested into a SQLite database (Prisma). The frontend lets you configure and trigger scrapes, browse results in a filterable/sortable table with a left filter rail, and annotate listings with notes, thumbs up/down, and favorites.

## Commands

- **Install dependencies:** `npm install`
- **Run dev server:** `npm run dev` (starts Next.js on http://localhost:3000)
- **Build for production:** `npm run build`
- **Start production server:** `npm start`
- **Run scraper standalone:** `node scripts/scrape_yachtworld.js` (uses defaults: used sailboats, $10k-$100k, 37-42ft)
- **Run scraper with args:** `node scripts/scrape_yachtworld.js --priceMin 20000 --priceMax 80000 --lengthMinFt 35 --lengthMaxFt 45 --condition used --excludeKetchYawl true --outputFile data/my_scrape.jsonl`
- **Prisma generate:** `npx prisma generate` (regenerate client after schema changes)
- **Prisma push:** `npx prisma db push` (sync schema to database)
- **Prisma studio:** `npx prisma studio` (GUI for browsing the database)

There is no linter or test suite configured.

## Architecture

### Data Flow

```
Scraper → JSONL file → Ingest Service → SQLite DB (Prisma)
                                              ↑
Frontend reads from DB, writes annotations ───┘
```

### Backend

- **scripts/scrape_yachtworld.js** — Main scraper (CommonJS). Uses `playwright-extra` with stealth plugin. Accepts CLI arguments for all search parameters. Outputs to JSONL files in `data/`.
- **lib/ingest.ts** — Reads a JSONL file, parses `buildYear` from listing names, inserts into DB (skips duplicates by `linkUrl`). Auto-runs after each scrape completes.
- **lib/scraper.ts** — Spawns the scraper as a child process, tracks status via `globalThis` singleton, auto-ingests on completion.
- **lib/prisma.ts** — Prisma client singleton (persisted via `globalThis` for HMR).
- **API routes:**
  - `POST /api/scrape` — Start a scrape with parameters (409 if already running)
  - `GET /api/scrape` — List available JSONL files
  - `GET /api/scrape/status` — Poll current scrape status
  - `POST /api/ingest` — Ingest a JSONL file into the database
  - `GET /api/results` — Read all listings from the database
  - `PATCH /api/listings/[id]` — Update annotations (notes, thumbs, favorite)

### Frontend

- **app/scrape/page.tsx** — Scrape config form (price, length, condition, ketch/yawl toggle, output filename)
- **app/results/** — Results page with sidebar filter rail, search, sortable table, expandable rows
- **components/results-filters.tsx** — Left rail: multi-select checkboxes (manufacturer, state), dual-thumb sliders (price, length, year), favorites toggle
- **components/results-table.tsx** — TanStack React Table with expandable rows
- **components/listing-detail.tsx** — Expanded row content: notes textarea, thumbs up/down, star/favorite

### Database

- SQLite at `data/yacht.db` via Prisma ORM
- Schema in `prisma/schema.prisma`
- `Listing` model: id, linkUrl (unique), buildYear, listingName, seller info, boat specs, priceUSD, dateLoaded, fileSource, notes, thumbs, favorite
- `buildYear` is parsed during ingest from listing names like "2006 Hunter 38" → year: 2006, name: "Hunter 38"

## Key Details

- Next.js 15 with App Router, React 19, TypeScript, Tailwind CSS v4, Radix UI
- Prisma 6 with SQLite — database file at `data/yacht.db` (gitignored)
- The scraper lives in `scripts/` as CommonJS `.js` — runs as a child process, never imported by Next.js
- Scraper defaults to headed mode (visible browser + DevTools) for Cloudflare bypass
- Random delays (3-5s) between page navigations to avoid rate limiting
- `.browser-profile/` contains persistent Chromium profile data — do not delete unless resetting Cloudflare session
- `data/` directory is gitignored — JSONL files and SQLite DB live here
- Client-side filtering/sorting via TanStack React Table (dataset is small enough)
- Annotations (notes, thumbs, favorites) persist in the database

## Tech Stack

- **Runtime:** Next.js, React, Prisma (SQLite), Playwright, playwright-extra, puppeteer-extra-plugin-stealth
- **UI:** Tailwind CSS, Radix UI (Select, Switch, Checkbox, Slider, Label, Slot), Lucide icons, TanStack React Table
- **Utilities:** clsx, tailwind-merge, class-variance-authority
