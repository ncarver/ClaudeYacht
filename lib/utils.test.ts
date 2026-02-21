import { cn, metersToFeet, formatPrice, formatLength } from "./utils";

describe("metersToFeet", () => {
  it("converts 12.8 meters to approximately 42 feet", () => {
    expect(metersToFeet(12.8)).toBeCloseTo(41.99, 1);
  });

  it("converts 0 meters to 0 feet", () => {
    expect(metersToFeet(0)).toBe(0);
  });

  it("converts 1 meter to 3.28084 feet", () => {
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 4);
  });
});

describe("formatPrice", () => {
  it("returns N/A for null", () => {
    expect(formatPrice(null)).toBe("N/A");
  });

  it("formats a price with dollar sign and commas", () => {
    expect(formatPrice(85000)).toBe("$85,000");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0");
  });

  it("formats large prices", () => {
    expect(formatPrice(1500000)).toBe("$1,500,000");
  });

  it("formats small prices without commas", () => {
    expect(formatPrice(500)).toBe("$500");
  });
});

describe("formatLength", () => {
  it("returns N/A for null", () => {
    expect(formatLength(null)).toBe("N/A");
  });

  it("formats meters to feet with one decimal", () => {
    expect(formatLength(12.8)).toBe("42.0 ft");
  });

  it("formats zero meters", () => {
    expect(formatLength(0)).toBe("0.0 ft");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
