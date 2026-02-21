import {
  parseProperties,
  parseSailboatData,
  parseReviews,
  parseForums,
  defaultBoatProperties,
  defaultSailboatDataSpecs,
} from "./types";

describe("parseProperties", () => {
  it("returns defaults for empty string", () => {
    expect(parseProperties("")).toEqual(defaultBoatProperties);
  });

  it("returns defaults for null-ish input", () => {
    // parseProperties takes string, but the underlying parseJsonColumn handles null
    expect(parseProperties("")).toEqual(defaultBoatProperties);
  });

  it("parses valid JSON and merges with defaults", () => {
    const input = JSON.stringify({ tillerSteering: true, furlingMain: true });
    const result = parseProperties(input);
    expect(result.tillerSteering).toBe(true);
    expect(result.furlingMain).toBe(true);
    expect(result.doubleEnder).toBe(false); // default preserved
  });

  it("returns defaults for malformed JSON", () => {
    expect(parseProperties("{bad json}")).toEqual(defaultBoatProperties);
  });

  it("preserves all default keys even with partial input", () => {
    const input = JSON.stringify({ doubleEnder: true });
    const result = parseProperties(input);
    expect(Object.keys(result)).toEqual(Object.keys(defaultBoatProperties));
  });
});

describe("parseSailboatData", () => {
  it("returns defaults for null", () => {
    expect(parseSailboatData(null)).toEqual(defaultSailboatDataSpecs);
  });

  it("returns defaults for empty string", () => {
    expect(parseSailboatData("")).toEqual(defaultSailboatDataSpecs);
  });

  it("parses valid specs", () => {
    const input = JSON.stringify({
      hullType: "Fin w/pointed cutaway",
      rigging: "Masthead Sloop",
      displacement: 22000,
    });
    const result = parseSailboatData(input);
    expect(result.hullType).toBe("Fin w/pointed cutaway");
    expect(result.rigging).toBe("Masthead Sloop");
    expect(result.displacement).toBe(22000);
    expect(result.sailboatDataUrl).toBeNull(); // default
  });

  it("returns defaults for malformed JSON", () => {
    expect(parseSailboatData("not json")).toEqual(defaultSailboatDataSpecs);
  });
});

describe("parseReviews", () => {
  it("returns empty array for null", () => {
    expect(parseReviews(null)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseReviews("")).toEqual([]);
  });

  it("parses valid review array", () => {
    const reviews = [
      { title: "Great boat", source: "Sailing Magazine", url: "https://example.com", excerpt: "..." },
    ];
    expect(parseReviews(JSON.stringify(reviews))).toEqual(reviews);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseReviews("{not an array}")).toEqual([]);
  });
});

describe("parseForums", () => {
  it("returns empty array for null", () => {
    expect(parseForums(null)).toEqual([]);
  });

  it("parses valid forum array", () => {
    const forums = [
      { title: "Owner review", source: "Cruisers Forum", url: "https://example.com", excerpt: "..." },
    ];
    expect(parseForums(JSON.stringify(forums))).toEqual(forums);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseForums("broken")).toEqual([]);
  });
});
