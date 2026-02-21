import {
  matchesSearch,
  matchesFilters,
  matchesFiltersExcept,
  getUniqueValues,
  getNumericRange,
  hasActiveFilters,
  defaultFilters,
} from "./filters";
import { createListing, createFilters, resetFixtureIds } from "@/test/fixtures";

beforeEach(() => {
  resetFixtureIds();
});

// --- matchesSearch ---

describe("matchesSearch", () => {
  const listing = createListing({
    listingName: "2005 Catalina 42",
    sellerName: "Bay Marine",
    sellerLocation: "San Francisco, CA",
    manufacturer: "Catalina",
    boatClass: "42",
    state: "California",
    notes: "nice boat",
  });

  it("returns true for empty search", () => {
    expect(matchesSearch(listing, "")).toBe(true);
  });

  it("matches listing name", () => {
    expect(matchesSearch(listing, "catalina")).toBe(true);
  });

  it("matches seller name", () => {
    expect(matchesSearch(listing, "bay marine")).toBe(true);
  });

  it("matches seller location", () => {
    expect(matchesSearch(listing, "san francisco")).toBe(true);
  });

  it("matches manufacturer", () => {
    expect(matchesSearch(listing, "Catalina")).toBe(true);
  });

  it("matches boat class", () => {
    expect(matchesSearch(listing, "42")).toBe(true);
  });

  it("matches state", () => {
    expect(matchesSearch(listing, "california")).toBe(true);
  });

  it("matches notes", () => {
    expect(matchesSearch(listing, "nice")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(matchesSearch(listing, "CATALINA")).toBe(true);
  });

  it("returns false for non-matching search", () => {
    expect(matchesSearch(listing, "beneteau")).toBe(false);
  });

  it("handles null fields gracefully", () => {
    const nullListing = createListing({
      listingName: null,
      sellerName: null,
      manufacturer: null,
    });
    expect(matchesSearch(nullListing, "anything")).toBe(false);
  });
});

// --- matchesFilters ---

describe("matchesFilters", () => {
  it("matches with default (empty) filters", () => {
    const listing = createListing();
    expect(matchesFilters(listing, defaultFilters)).toBe(true);
  });

  // Manufacturer tri-state
  it("filters by manufacturer include", () => {
    const listing = createListing({ manufacturer: "Catalina" });
    const filters = createFilters({
      manufacturers: { include: ["Catalina"], exclude: [] },
    });
    expect(matchesFilters(listing, filters)).toBe(true);
  });

  it("excludes non-matching manufacturer include", () => {
    const listing = createListing({ manufacturer: "Beneteau" });
    const filters = createFilters({
      manufacturers: { include: ["Catalina"], exclude: [] },
    });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("excludes manufacturer by exclude filter", () => {
    const listing = createListing({ manufacturer: "Hunter" });
    const filters = createFilters({
      manufacturers: { include: [], exclude: ["Hunter"] },
    });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("excludes listing with null manufacturer when include is set", () => {
    const listing = createListing({ manufacturer: null });
    const filters = createFilters({
      manufacturers: { include: ["Catalina"], exclude: [] },
    });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  // State tri-state
  it("filters by state include", () => {
    const listing = createListing({ state: "Florida" });
    const filters = createFilters({
      states: { include: ["Florida"], exclude: [] },
    });
    expect(matchesFilters(listing, filters)).toBe(true);
  });

  it("excludes by state exclude", () => {
    const listing = createListing({ state: "Texas" });
    const filters = createFilters({
      states: { include: [], exclude: ["Texas"] },
    });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  // Price range
  it("filters by price min", () => {
    const listing = createListing({ priceUSD: 50000 });
    const filters = createFilters({ priceMin: 60000 });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("filters by price max", () => {
    const listing = createListing({ priceUSD: 100000 });
    const filters = createFilters({ priceMax: 90000 });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("passes price within range", () => {
    const listing = createListing({ priceUSD: 75000 });
    const filters = createFilters({ priceMin: 50000, priceMax: 100000 });
    expect(matchesFilters(listing, filters)).toBe(true);
  });

  it("treats null price as 0 for price filters", () => {
    const listing = createListing({ priceUSD: null });
    const filters = createFilters({ priceMin: 10000 });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  // Length range
  it("filters by length min (converts meters to feet)", () => {
    const listing = createListing({ lengthInMeters: 10 }); // ~32.8 ft
    const filters = createFilters({ lengthMinFt: 35 });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("filters by length max", () => {
    const listing = createListing({ lengthInMeters: 15 }); // ~49.2 ft
    const filters = createFilters({ lengthMaxFt: 45 });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("treats null length as 0 for min filter", () => {
    const listing = createListing({ lengthInMeters: null });
    const filters = createFilters({ lengthMinFt: 30 });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  // Year range
  it("filters by year min", () => {
    const listing = createListing({ buildYear: 1990 });
    const filters = createFilters({ yearMin: 2000 });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("filters by year max", () => {
    const listing = createListing({ buildYear: 2020 });
    const filters = createFilters({ yearMax: 2015 });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("passes year within range", () => {
    const listing = createListing({ buildYear: 2005 });
    const filters = createFilters({ yearMin: 2000, yearMax: 2010 });
    expect(matchesFilters(listing, filters)).toBe(true);
  });

  // Favorites
  it("filters favorites only", () => {
    const listing = createListing({ favorite: false });
    const filters = createFilters({ favoritesOnly: true });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("passes favorites filter when listing is favorite", () => {
    const listing = createListing({ favorite: true });
    const filters = createFilters({ favoritesOnly: true });
    expect(matchesFilters(listing, filters)).toBe(true);
  });

  // Hide thumbs down
  it("hides thumbs down listings", () => {
    const listing = createListing({ thumbs: "down" });
    const filters = createFilters({ hideThumbsDown: true });
    expect(matchesFilters(listing, filters)).toBe(false);
  });

  it("shows thumbs up when hiding thumbs down", () => {
    const listing = createListing({ thumbs: "up" });
    const filters = createFilters({ hideThumbsDown: true });
    expect(matchesFilters(listing, filters)).toBe(true);
  });

  it("shows null thumbs when hiding thumbs down", () => {
    const listing = createListing({ thumbs: null });
    const filters = createFilters({ hideThumbsDown: true });
    expect(matchesFilters(listing, filters)).toBe(true);
  });

  // Exclude dimension
  it("skips manufacturer filter when excluded", () => {
    const listing = createListing({ manufacturer: "Beneteau" });
    const filters = createFilters({
      manufacturers: { include: ["Catalina"], exclude: [] },
    });
    expect(matchesFilters(listing, filters, "manufacturers")).toBe(true);
  });

  it("skips price filter when excluded", () => {
    const listing = createListing({ priceUSD: 5000 });
    const filters = createFilters({ priceMin: 50000 });
    expect(matchesFilters(listing, filters, "price")).toBe(true);
  });

  it("skips length filter when excluded", () => {
    const listing = createListing({ lengthInMeters: 5 });
    const filters = createFilters({ lengthMinFt: 40 });
    expect(matchesFilters(listing, filters, "length")).toBe(true);
  });

  it("skips year filter when excluded", () => {
    const listing = createListing({ buildYear: 1970 });
    const filters = createFilters({ yearMin: 2000 });
    expect(matchesFilters(listing, filters, "year")).toBe(true);
  });

  it("skips favorites filter when excluded", () => {
    const listing = createListing({ favorite: false });
    const filters = createFilters({ favoritesOnly: true });
    expect(matchesFilters(listing, filters, "favorites")).toBe(true);
  });
});

// --- matchesFiltersExcept ---

describe("matchesFiltersExcept", () => {
  it("delegates to matchesFilters with exclude", () => {
    const listing = createListing({ manufacturer: "Beneteau" });
    const filters = createFilters({
      manufacturers: { include: ["Catalina"], exclude: [] },
    });
    expect(matchesFiltersExcept(listing, filters, "manufacturers")).toBe(true);
  });
});

// --- getUniqueValues ---

describe("getUniqueValues", () => {
  it("returns empty array for empty listings", () => {
    expect(getUniqueValues([], "manufacturer")).toEqual([]);
  });

  it("returns sorted unique values", () => {
    const listings = [
      createListing({ manufacturer: "Catalina" }),
      createListing({ manufacturer: "Beneteau" }),
      createListing({ manufacturer: "Catalina" }),
    ];
    expect(getUniqueValues(listings, "manufacturer")).toEqual(["Beneteau", "Catalina"]);
  });

  it("excludes null values", () => {
    const listings = [
      createListing({ manufacturer: "Catalina" }),
      createListing({ manufacturer: null }),
    ];
    expect(getUniqueValues(listings, "manufacturer")).toEqual(["Catalina"]);
  });

  it("excludes empty string values", () => {
    const listings = [
      createListing({ state: "" }),
      createListing({ state: "Florida" }),
    ];
    expect(getUniqueValues(listings, "state")).toEqual(["Florida"]);
  });
});

// --- getNumericRange ---

describe("getNumericRange", () => {
  it("returns [0, 0] for empty listings", () => {
    expect(getNumericRange([], "priceUSD")).toEqual([0, 0]);
  });

  it("returns min and max for prices", () => {
    const listings = [
      createListing({ priceUSD: 50000 }),
      createListing({ priceUSD: 100000 }),
      createListing({ priceUSD: 75000 }),
    ];
    expect(getNumericRange(listings, "priceUSD")).toEqual([50000, 100000]);
  });

  it("handles single value", () => {
    const listings = [createListing({ priceUSD: 80000 })];
    expect(getNumericRange(listings, "priceUSD")).toEqual([80000, 80000]);
  });

  it("ignores null values", () => {
    const listings = [
      createListing({ priceUSD: null }),
      createListing({ priceUSD: 60000 }),
    ];
    expect(getNumericRange(listings, "priceUSD")).toEqual([60000, 60000]);
  });

  it("returns [0, 0] when all values are null", () => {
    const listings = [
      createListing({ priceUSD: null }),
      createListing({ priceUSD: null }),
    ];
    expect(getNumericRange(listings, "priceUSD")).toEqual([0, 0]);
  });
});

// --- hasActiveFilters ---

describe("hasActiveFilters", () => {
  it("returns false for default filters", () => {
    expect(hasActiveFilters(defaultFilters)).toBe(false);
  });

  it("returns true when manufacturer include is set", () => {
    const filters = createFilters({
      manufacturers: { include: ["Catalina"], exclude: [] },
    });
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("returns true when manufacturer exclude is set", () => {
    const filters = createFilters({
      manufacturers: { include: [], exclude: ["Hunter"] },
    });
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("returns true when priceMin is set", () => {
    expect(hasActiveFilters(createFilters({ priceMin: 10000 }))).toBe(true);
  });

  it("returns true when priceMax is set", () => {
    expect(hasActiveFilters(createFilters({ priceMax: 100000 }))).toBe(true);
  });

  it("returns true when lengthMinFt is set", () => {
    expect(hasActiveFilters(createFilters({ lengthMinFt: 30 }))).toBe(true);
  });

  it("returns true when yearMin is set", () => {
    expect(hasActiveFilters(createFilters({ yearMin: 2000 }))).toBe(true);
  });

  it("returns true when favoritesOnly is set", () => {
    expect(hasActiveFilters(createFilters({ favoritesOnly: true }))).toBe(true);
  });

  it("returns true when hideThumbsDown is set", () => {
    expect(hasActiveFilters(createFilters({ hideThumbsDown: true }))).toBe(true);
  });
});

// --- defaultFilters snapshot ---

describe("defaultFilters", () => {
  it("has expected shape", () => {
    expect(defaultFilters).toEqual({
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
    });
  });
});
