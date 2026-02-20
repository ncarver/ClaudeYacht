import type { Listing, Filters, TriStateFilter } from "./types";
import { metersToFeet } from "./utils";

export function matchesSearch(listing: Listing, search: string): boolean {
  if (!search) return true;
  const lower = search.toLowerCase();
  return [
    listing.listingName,
    listing.sellerName,
    listing.sellerLocation,
    listing.manufacturer,
    listing.boatClass,
    listing.state,
    listing.notes,
  ].some((field) => field?.toLowerCase().includes(lower));
}

function matchesTriState(
  value: string | null,
  filter: TriStateFilter
): boolean {
  if (
    filter.include.length > 0 &&
    (!value || !filter.include.includes(value))
  ) {
    return false;
  }
  if (filter.exclude.length > 0 && value && filter.exclude.includes(value)) {
    return false;
  }
  return true;
}

export type FilterDimension =
  | "manufacturers"
  | "states"
  | "price"
  | "length"
  | "year"
  | "favorites";

export function matchesFilters(
  listing: Listing,
  filters: Filters,
  exclude?: FilterDimension
): boolean {
  if (
    exclude !== "manufacturers" &&
    !matchesTriState(listing.manufacturer, filters.manufacturers)
  ) {
    return false;
  }

  if (
    exclude !== "states" &&
    !matchesTriState(listing.state, filters.states)
  ) {
    return false;
  }

  if (exclude !== "price") {
    if (
      filters.priceMin != null &&
      (listing.priceUSD ?? 0) < filters.priceMin
    ) {
      return false;
    }
    if (
      filters.priceMax != null &&
      (listing.priceUSD ?? 0) > filters.priceMax
    ) {
      return false;
    }
  }

  if (exclude !== "length") {
    const lengthFt = listing.lengthInMeters
      ? metersToFeet(listing.lengthInMeters)
      : null;
    if (filters.lengthMinFt != null && (lengthFt ?? 0) < filters.lengthMinFt) {
      return false;
    }
    if (filters.lengthMaxFt != null && (lengthFt ?? 0) > filters.lengthMaxFt) {
      return false;
    }
  }

  if (exclude !== "year") {
    if (filters.yearMin != null && (listing.buildYear ?? 0) < filters.yearMin) {
      return false;
    }
    if (
      filters.yearMax != null &&
      (listing.buildYear ?? Infinity) > filters.yearMax
    ) {
      return false;
    }
  }

  if (exclude !== "favorites" && filters.favoritesOnly && !listing.favorite) {
    return false;
  }

  if (filters.hideThumbsDown && listing.thumbs === "down") {
    return false;
  }

  return true;
}

export function matchesFiltersExcept(
  listing: Listing,
  filters: Filters,
  exclude: FilterDimension
): boolean {
  return matchesFilters(listing, filters, exclude);
}

export function getUniqueValues(
  listings: Listing[],
  key: keyof Listing
): string[] {
  const values = new Set<string>();
  for (const listing of listings) {
    const val = listing[key];
    if (typeof val === "string" && val) {
      values.add(val);
    }
  }
  return Array.from(values).sort();
}

export function getNumericRange(
  listings: Listing[],
  key: keyof Listing
): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const listing of listings) {
    const val = listing[key];
    if (typeof val === "number" && val != null) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }
  return min === Infinity ? [0, 0] : [min, max];
}

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.manufacturers.include.length > 0 ||
    filters.manufacturers.exclude.length > 0 ||
    filters.states.include.length > 0 ||
    filters.states.exclude.length > 0 ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    filters.lengthMinFt != null ||
    filters.lengthMaxFt != null ||
    filters.yearMin != null ||
    filters.yearMax != null ||
    filters.favoritesOnly ||
    filters.hideThumbsDown
  );
}

export const defaultFilters: Filters = {
  manufacturers: { include: [], exclude: [] },
  states: { include: [], exclude: [] },
  priceMin: null,
  priceMax: null,
  lengthMinFt: null,
  lengthMaxFt: null,
  yearMin: null,
  yearMax: null,
  favoritesOnly: false,
  hideThumbsDown: false,
};
