import type { ScrapeParams } from "./types";

export function buildYachtWorldUrl(params: ScrapeParams): string {
  const conditionSegment =
    params.condition === "any" ? "" : `condition-${params.condition}/`;

  return `https://www.yachtworld.com/boats-for-sale/${conditionSegment}type-sail/?price=${params.priceMin}-${params.priceMax}&length=${params.lengthMinFt}-${params.lengthMaxFt}&currency=USD`;
}
