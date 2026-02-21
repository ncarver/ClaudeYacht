import { parseListingId } from "./api-utils";

describe("parseListingId", () => {
  it("parses a valid numeric ID", async () => {
    const result = await parseListingId(Promise.resolve({ id: "42" }));
    expect(result.listingId).toBe(42);
    expect(result.error).toBeUndefined();
  });

  it("returns error for non-numeric ID", async () => {
    const result = await parseListingId(Promise.resolve({ id: "abc" }));
    expect(result.listingId).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(400);
  });

  it("returns error for empty string", async () => {
    const result = await parseListingId(Promise.resolve({ id: "" }));
    expect(result.listingId).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  it("parses integer from float string", async () => {
    const result = await parseListingId(Promise.resolve({ id: "1.5" }));
    expect(result.listingId).toBe(1);
  });
});
