import type { Listing, Filters } from "@/lib/types";
import { defaultBoatProperties } from "@/lib/types";
import { defaultFilters } from "@/lib/filters";

let nextId = 1;

export function createListing(overrides: Partial<Listing> = {}): Listing {
  const id = nextId++;
  return {
    id,
    linkUrl: `https://www.yachtworld.com/boat/test-${id}`,
    buildYear: 2005,
    listingName: "2005 Catalina 42",
    sellerName: "Bay Marine",
    sellerLocation: "San Francisco, CA",
    imgUrl: "https://images.boatsgroup.com/test.jpg",
    manufacturer: "Catalina",
    boatClass: "42",
    lengthInMeters: 12.8,
    state: "California",
    priceUSD: 85000,
    dateLoaded: "2025-01-15T00:00:00.000Z",
    fileSource: "test.jsonl",
    notes: "",
    thumbs: null,
    favorite: false,
    properties: JSON.stringify(defaultBoatProperties),
    ...overrides,
  };
}

export function createFilters(overrides: Partial<Filters> = {}): Filters {
  return { ...defaultFilters, ...overrides };
}

export function resetFixtureIds(): void {
  nextId = 1;
}
