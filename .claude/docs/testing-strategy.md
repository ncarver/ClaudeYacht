# Testing Strategy

## Overview

Full-stack testing with two tiers: **fast tests** (Vitest, no browser) and **E2E tests** (Playwright, real browser).

## Commands

| Command | What runs | Speed | When to use |
|---------|-----------|-------|-------------|
| `npm test` | Vitest: pure functions, API routes, components | **~2s**. In-memory DOM, no browser. | TDD loop, every save |
| `npm run test:watch` | Same, in watch mode | Instant re-runs on file change | Active development |
| `npm run test:e2e` | Playwright: real browser tests | **~30-60s**. Launches Chromium. | Before commits/PRs |
| `npm run test:all` | Both tiers sequentially | Full suite | CI pipeline |
| `npm run test:coverage` | Vitest + V8 coverage report | Fast + report | Coverage checks |

## Stack

- **Vitest** — test runner (fast, native ESM/TS, Jest-compatible API)
- **happy-dom** — lightweight DOM for component tests (no browser)
- **React Testing Library** — component testing via user-facing queries
- **vitest-mock-extended** — deep Prisma client mocks
- **MSW** — network request mocking (Mock Service Worker)
- **Playwright Test** — E2E browser automation

## Test File Locations

Tests are co-located with source files using `*.test.ts` / `*.test.tsx` naming:

```
lib/
  utils.test.ts           # metersToFeet, formatPrice, formatLength, cn
  types.test.ts           # JSON parsers (parseProperties, parseSailboatData, etc.)
  filters.test.ts         # matchesSearch, matchesFilters, tri-state, facets
  api-utils.test.ts       # parseListingId
  ingest.test.ts          # parseBuildYear
  research-helpers.test.ts # scoreCandidate, computeYearRange, parseSpecsFromHtml, etc.
app/api/
  results/route.test.ts
  listings/[id]/route.test.ts
  ingest/route.test.ts
  scrape/route.test.ts
components/
  results-search.test.tsx
  listing-detail.test.tsx
  results-table.test.tsx
e2e/
  navigation.spec.ts
  filtering.spec.ts
  listing-interaction.spec.ts
```

## Test Infrastructure

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest config: React plugin, path aliases, env matching |
| `playwright.config.ts` | E2E config: webServer auto-start, Chromium |
| `test/setup.ts` | jest-dom matchers |
| `test/fixtures.ts` | `createListing()`, `createFilters()` factory functions |
| `test/render.tsx` | Custom render with ThemeProvider |
| `lib/__mocks__/prisma.ts` | Deep Prisma mock with auto-reset |

## Key Patterns

### Prisma Mocking (API Routes)
```typescript
vi.mock("@/lib/prisma", () => import("@/lib/__mocks__/prisma"));
import prismaMock from "@/lib/__mocks__/prisma";

prismaMock.listing.findMany.mockResolvedValue([...]);
```

### Component Testing
```typescript
import { render, screen, userEvent } from "@/test/render";
// Custom render wraps with ThemeProvider
```

### Refactored Modules
- `lib/research-helpers.ts` — pure functions extracted from `research.ts` for testability
- `lib/ingest.ts` — `parseBuildYear()` exported for direct testing

## Adding New Tests

1. Create `*.test.ts(x)` alongside the source file
2. Use `createListing()` / `createFilters()` from `test/fixtures.ts` for test data
3. For API routes: mock Prisma, import route handler directly, construct `NextRequest`
4. For components: use `render()` from `test/render.tsx`, query via `screen.*`
5. Run `npm test` to verify
