# scripts/

## CommonJS Only

This directory contains standalone Node.js scripts that use `require()` syntax. Do **not** convert to TypeScript or ESM — the scraper depends on `playwright-extra` and `puppeteer-extra-plugin-stealth` which require CommonJS.

## Never Import into Next.js

These scripts run as spawned child processes (via `lib/scraper.ts`), not as part of the Next.js bundle. Importing them into Next.js will break the build due to Playwright/stealth dependencies.

## CLI Arguments

`scrape_yachtworld.js` accepts `--key value` pairs:

| Argument | Default | Notes |
|---|---|---|
| `priceMin` | `10000` | |
| `priceMax` | `100000` | |
| `lengthMinFt` | `37` | |
| `lengthMaxFt` | `42` | |
| `condition` | `used` | `used`, `new`, or `any` |
| `excludeKetchYawl` | `true` | Set `false` to include |
| `excludeMultihull` | `true` | Set `false` to include |
| `headless` | `false` | Runs headed for Cloudflare bypass |
| `outputFile` | `data/yachtworld_results.jsonl` | |

## Browser Profile

Uses a persistent Chromium profile at `.browser-profile/` (gitignored) to maintain Cloudflare session cookies across runs.

## Testing Changes

Run directly: `node scripts/scrape_yachtworld.js`
Or via the web UI scrape page, which calls `lib/scraper.ts` to spawn it.
