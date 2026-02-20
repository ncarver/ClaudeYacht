# lib/

## globalThis Singletons

`prisma.ts`, `scraper.ts`, and `research.ts` all persist state across Next.js HMR via `globalThis`. Pattern: declare a global var, check on access, create if missing, assign back. Follow this for any new server-side singleton.

## Prisma Imports

Always import from `@/lib/prisma` (the singleton), never from `@prisma/client` directly.

## Types in One File

All TypeScript interfaces and type constants live in `types.ts`. Don't create per-module type files.

## JSON-in-SQLite Parsers

`parseProperties()`, `parseSailboatData()`, `parseReviews()`, `parseForums()` all follow the same pattern:
1. Accept a raw JSON string (possibly null/corrupt)
2. Parse with `JSON.parse`, fall back to defaults on error
3. Merge with a default object to fill missing keys

Follow this pattern for any new JSON columns added to Prisma.

## research.ts Conventions

- **AsyncMutex** serializes Playwright browser sessions — never run multiple concurrently
- **Human-in-the-loop** works via resolve callbacks stored on the `ResearchJob` object; API routes call the resolver, which unblocks the pipeline
- **SSE listeners** are registered per-job in the `listeners` set; status changes broadcast to all listeners
- The research pipeline runs: sailboatdata.com specs → professional reviews (DuckDuckGo) → owners forums (DuckDuckGo), with a human selection step after each
