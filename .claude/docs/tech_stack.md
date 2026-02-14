# Tech Stack

## Runtime & Framework
- **Next.js 15** — App Router, React 19, TypeScript
- **Prisma 6** — ORM with SQLite (`data/yacht.db`)
- **Playwright + playwright-extra + puppeteer-extra-plugin-stealth** — Headless browser scraping with Cloudflare bypass

## UI Libraries
- **Tailwind CSS v4** — Styling with `@theme inline` for CSS variable-based theming
- **Radix UI** — Primitives: Checkbox, Dialog, Label, Select, Slider, Slot, Switch
- **Lucide React** — Icons
- **TanStack React Table v8** — Sortable, expandable, resizable data table
- **next-themes** — System/light/dark mode via `attribute="class"` strategy
- **class-variance-authority** — Component variant management (used in `components/ui/button.tsx`)
- **clsx + tailwind-merge** — Class name utilities (combined in `lib/utils.ts:4`)

## Key Configurations
- `next.config.ts` — `serverExternalPackages` for Playwright/Prisma; `devIndicators: false`
- `prisma.config.ts` — Schema path and database URL
- `postcss.config.mjs` — Tailwind CSS v4 PostCSS plugin
- `tsconfig.json` — `@/` path alias maps to project root

## No Linter or Test Suite
There is no ESLint, Prettier, or test framework configured.
