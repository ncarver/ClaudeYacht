import { parseBuildYear } from "./ingest";

describe("parseBuildYear", () => {
  it("extracts year and name from standard listing", () => {
    expect(parseBuildYear("2005 Catalina 42")).toEqual({
      buildYear: 2005,
      name: "Catalina 42",
    });
  });

  it("extracts year from listing with long name", () => {
    expect(parseBuildYear("1998 Dufour Classic 41")).toEqual({
      buildYear: 1998,
      name: "Dufour Classic 41",
    });
  });

  it("returns null year for name without leading year", () => {
    expect(parseBuildYear("Catalina 42")).toEqual({
      buildYear: null,
      name: "Catalina 42",
    });
  });

  it("returns nulls for null input", () => {
    expect(parseBuildYear(null)).toEqual({
      buildYear: null,
      name: null,
    });
  });

  it("returns null year for empty string", () => {
    expect(parseBuildYear("")).toEqual({
      buildYear: null,
      name: null,
    });
  });

  it("returns null year when name is just a year (no trailing name)", () => {
    // "2005" alone doesn't match /^(\d{4})\s+(.+)$/ because there's no trailing text
    expect(parseBuildYear("2005")).toEqual({
      buildYear: null,
      name: "2005",
    });
  });
});
