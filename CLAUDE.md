# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YachtWorld web scraper using Playwright with stealth plugins to bypass Cloudflare detection. Scrapes used sailboat listings and outputs structured data to JSONL.

## Commands

- **Install dependencies:** `npm install`
- **Run the scraper:** `node scrape_yachtworld.js` (launches a visible browser, requires display)
- **Run discovery scripts:** `node discover_html.js` or `node discover_pagination.js`

There is no build step, linter, or test suite configured.

## Architecture

- **scrape_yachtworld.js** — Main scraper. Uses `playwright-extra` with `puppeteer-extra-plugin-stealth` to avoid bot detection. Opens a persistent browser context (stored in `.browser-profile/`) to retain Cloudflare cookies across runs. Paginates through search results, extracts listing cards via `data-ssr-meta` attributes, filters out sponsored/ketch/yawl listings, and appends results to `yachtworld_results.jsonl` (one JSON object per line).
- **discover_html.js / discover_pagination.js** — One-off exploration scripts used to reverse-engineer YachtWorld's DOM structure and pagination. Use plain `playwright` (no stealth).

## Key Details

- CommonJS modules (`"type": "commonjs"` in package.json)
- The scraper runs in **headed mode** (non-headless) with DevTools auto-opened for debugging
- Random delays (3–5s) between page navigations to avoid rate limiting
- Output format is JSONL with fields: `listingName`, `sellerName`, `sellerLocation`, `imgUrl`, `linkUrl`, `manufacturer`, `boatClass`, `lengthInMeters`, `state`, `priceUSD`
- `.browser-profile/` contains persistent Chromium profile data — do not delete unless you want to reset Cloudflare session state
