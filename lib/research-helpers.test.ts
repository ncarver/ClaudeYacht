import * as cheerio from "cheerio";
import {
  extractSearchKeyword,
  buildFallbackKeyword,
  scoreCandidate,
  markRecommended,
  computeYearRange,
  extractDomain,
  parseSpecsFromHtml,
} from "./research-helpers";
import type { SailboatCandidate } from "@/lib/types";
import type { SailboatDataContext } from "./research-helpers";

// ---- extractSearchKeyword ----

describe("extractSearchKeyword", () => {
  it("strips leading year from listing name", () => {
    expect(extractSearchKeyword("2005 Dufour Classic 41")).toBe("Dufour Classic 41");
  });

  it("returns name as-is when no leading year", () => {
    expect(extractSearchKeyword("Catalina 42")).toBe("Catalina 42");
  });

  it("returns null for null input", () => {
    expect(extractSearchKeyword(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractSearchKeyword("")).toBeNull();
  });

  it("returns year as keyword when no trailing text", () => {
    // "2005" doesn't match /^\d{4}\s+/ because there's no whitespace after the year
    expect(extractSearchKeyword("2005")).toBe("2005");
  });

  it("strips year with extra whitespace", () => {
    expect(extractSearchKeyword("2005  Catalina 42")).toBe("Catalina 42");
  });
});

// ---- buildFallbackKeyword ----

describe("buildFallbackKeyword", () => {
  it("combines manufacturer and length in feet", () => {
    expect(buildFallbackKeyword("Catalina", 12.8)).toBe("Catalina 42");
  });

  it("returns manufacturer only when no length", () => {
    expect(buildFallbackKeyword("Catalina", null)).toBe("Catalina");
  });

  it("returns null when no manufacturer", () => {
    expect(buildFallbackKeyword(null, 12.8)).toBeNull();
  });

  it("returns null when both are null", () => {
    expect(buildFallbackKeyword(null, null)).toBeNull();
  });

  it("rounds length to nearest foot", () => {
    // 10 meters = 32.8084 feet → rounds to 33
    expect(buildFallbackKeyword("Beneteau", 10)).toBe("Beneteau 33");
  });
});

// ---- scoreCandidate ----

describe("scoreCandidate", () => {
  const baseContext: SailboatDataContext = {
    listingName: "2005 Catalina 42",
    manufacturer: "Catalina",
    buildYear: 2005,
    lengthInMeters: 12.8,
  };

  function makeCandidate(overrides: Partial<SailboatCandidate> = {}): SailboatCandidate {
    return {
      modelName: "Catalina 42",
      slug: "catalina-42",
      loa: "42.0",
      firstBuilt: "2003",
      recommended: false,
      ...overrides,
    };
  }

  it("gives 100 points for exact name match", () => {
    const score = scoreCandidate(
      makeCandidate({ modelName: "Catalina 42" }),
      baseContext
    );
    // 100 (exact match) + year proximity bonus
    expect(score).toBeGreaterThanOrEqual(100);
  });

  it("gives 50 points for containment match", () => {
    const score = scoreCandidate(
      makeCandidate({ modelName: "Catalina 42 MKII" }),
      baseContext
    );
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it("gives partial word match score", () => {
    const score = scoreCandidate(
      makeCandidate({ modelName: "Catalina 400" }),
      baseContext
    );
    // "Catalina" matches but "42" doesn't → partial score
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(50);
  });

  it("gives year proximity bonus", () => {
    const exactYear = scoreCandidate(
      makeCandidate({ modelName: "Foo", firstBuilt: "2005" }),
      baseContext
    );
    const farYear = scoreCandidate(
      makeCandidate({ modelName: "Foo", firstBuilt: "1985" }),
      baseContext
    );
    expect(exactYear).toBeGreaterThan(farYear);
  });

  it("gives 20 points for exact year match", () => {
    const score = scoreCandidate(
      makeCandidate({ modelName: "ZZZZ", firstBuilt: "2005" }),
      baseContext
    );
    // No name match, but 20 year points
    expect(score).toBe(20);
  });

  it("handles null listing name", () => {
    const score = scoreCandidate(
      makeCandidate(),
      { ...baseContext, listingName: null }
    );
    // Only year proximity
    expect(score).toBeGreaterThan(0);
  });

  it("handles null build year", () => {
    const score = scoreCandidate(
      makeCandidate(),
      { ...baseContext, buildYear: null }
    );
    // Only name match, no year bonus
    expect(score).toBeGreaterThanOrEqual(100);
  });

  it("handles null firstBuilt on candidate", () => {
    const score = scoreCandidate(
      makeCandidate({ firstBuilt: null }),
      baseContext
    );
    // Name match but no year bonus
    expect(score).toBe(100);
  });
});

// ---- markRecommended ----

describe("markRecommended", () => {
  const context: SailboatDataContext = {
    listingName: "2005 Catalina 42",
    manufacturer: "Catalina",
    buildYear: 2005,
    lengthInMeters: 12.8,
  };

  it("marks the highest scoring candidate", () => {
    const candidates: SailboatCandidate[] = [
      { modelName: "Beneteau 40", slug: "b40", loa: null, firstBuilt: null, recommended: false },
      { modelName: "Catalina 42", slug: "c42", loa: null, firstBuilt: "2003", recommended: false },
      { modelName: "Hunter 37", slug: "h37", loa: null, firstBuilt: null, recommended: false },
    ];
    markRecommended(candidates, context);
    expect(candidates[1].recommended).toBe(true);
    expect(candidates[0].recommended).toBe(false);
    expect(candidates[2].recommended).toBe(false);
  });

  it("does nothing for empty array", () => {
    const candidates: SailboatCandidate[] = [];
    markRecommended(candidates, context);
    expect(candidates).toEqual([]);
  });

  it("marks the only candidate", () => {
    const candidates: SailboatCandidate[] = [
      { modelName: "Foo", slug: "foo", loa: null, firstBuilt: null, recommended: false },
    ];
    markRecommended(candidates, context);
    expect(candidates[0].recommended).toBe(true);
  });
});

// ---- computeYearRange ----

describe("computeYearRange", () => {
  it("uses sailboatdata years when both available", () => {
    expect(computeYearRange(2005, { first: 1998, last: 2010 })).toEqual({
      yearMin: 1998,
      yearMax: 2010,
    });
  });

  it("uses first as both when last is null", () => {
    expect(computeYearRange(2005, { first: 1998, last: null })).toEqual({
      yearMin: 1998,
      yearMax: 1998,
    });
  });

  it("uses last as both when first is null", () => {
    expect(computeYearRange(2005, { first: null, last: 2010 })).toEqual({
      yearMin: 2010,
      yearMax: 2010,
    });
  });

  it("falls back to decade from build year", () => {
    expect(computeYearRange(2005)).toEqual({
      yearMin: 2000,
      yearMax: 2009,
    });
  });

  it("falls back to decade from build year (1990s)", () => {
    expect(computeYearRange(1993)).toEqual({
      yearMin: 1990,
      yearMax: 1999,
    });
  });

  it("returns nulls when no data available", () => {
    expect(computeYearRange(null)).toEqual({
      yearMin: null,
      yearMax: null,
    });
  });

  it("returns nulls when sailboatdata years are both null", () => {
    expect(computeYearRange(null, { first: null, last: null })).toEqual({
      yearMin: null,
      yearMax: null,
    });
  });

  it("prefers sailboatdata years over build year", () => {
    expect(computeYearRange(2005, { first: 1990, last: 2000 })).toEqual({
      yearMin: 1990,
      yearMax: 2000,
    });
  });
});

// ---- extractDomain ----

describe("extractDomain", () => {
  it("extracts domain from URL", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });

  it("strips www prefix", () => {
    expect(extractDomain("https://www.cruisersforum.com/thread")).toBe("cruisersforum.com");
  });

  it("keeps subdomain other than www", () => {
    expect(extractDomain("https://blog.example.com")).toBe("blog.example.com");
  });

  it("returns raw string for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("not-a-url");
  });
});

// ---- parseSpecsFromHtml ----

describe("parseSpecsFromHtml", () => {
  it("parses specs from table layout", () => {
    const html = `
      <table><tbody>
        <tr><td>Hull Type</td><td>Fin w/pointed cutaway</td></tr>
        <tr><td>Rigging</td><td>Masthead Sloop</td></tr>
        <tr><td>Displacement</td><td>22,000 lbs</td></tr>
        <tr><td>LOA</td><td>42.5 ft</td></tr>
        <tr><td>Designer</td><td>Frank Butler</td></tr>
        <tr><td>First Built</td><td>1988</td></tr>
        <tr><td>Last Built</td><td>2003</td></tr>
        <tr><td># Built</td><td>1250</td></tr>
        <tr><td>Draft</td><td>4.5 / 6.5</td></tr>
      </tbody></table>
    `;
    const $ = cheerio.load(html);
    const specs = parseSpecsFromHtml($);

    expect(specs.hullType).toBe("Fin w/pointed cutaway");
    expect(specs.rigging).toBe("Masthead Sloop");
    expect(specs.displacement).toBe(22000);
    expect(specs.loa).toBe(42.5);
    expect(specs.designer).toBe("Frank Butler");
    expect(specs.firstBuilt).toBe(1988);
    expect(specs.lastBuilt).toBe(2003);
    expect(specs.numberOfBoats).toBe(1250);
    expect(specs.draftMin).toBe(4.5);
    expect(specs.draftMax).toBe(6.5);
  });

  it("parses specs from dt/dd layout", () => {
    const html = `
      <dl>
        <dt>Hull Type</dt><dd>Fin</dd>
        <dt>Construction</dt><dd>Fiberglass</dd>
      </dl>
    `;
    const $ = cheerio.load(html);
    const specs = parseSpecsFromHtml($);

    expect(specs.hullType).toBe("Fin");
    expect(specs.construction).toBe("Fiberglass");
  });

  it("returns defaults for empty HTML", () => {
    const $ = cheerio.load("<html><body></body></html>");
    const specs = parseSpecsFromHtml($);

    expect(specs.hullType).toBeNull();
    expect(specs.displacement).toBeNull();
    expect(specs.sailboatDataUrl).toBeNull();
  });

  it("handles single draft value", () => {
    const html = `<table><tbody><tr><td>Draft</td><td>5.5</td></tr></tbody></table>`;
    const $ = cheerio.load(html);
    const specs = parseSpecsFromHtml($);

    expect(specs.draftMin).toBe(5.5);
    expect(specs.draftMax).toBe(5.5);
  });
});
