import { GET } from "./route";
import prismaMock from "@/lib/__mocks__/prisma";

vi.mock("@/lib/prisma", () => import("@/lib/__mocks__/prisma"));

describe("GET /api/results", () => {
  it("returns listings with research status mapped", async () => {
    prismaMock.listing.findMany.mockResolvedValue([
      {
        id: 1,
        linkUrl: "https://example.com/boat/1",
        listingName: "2005 Catalina 42",
        manufacturer: "Catalina",
        priceUSD: 85000,
        research: { status: "complete" },
      },
      {
        id: 2,
        linkUrl: "https://example.com/boat/2",
        listingName: "2003 Beneteau 40",
        manufacturer: "Beneteau",
        priceUSD: 70000,
        research: null,
      },
    ] as never);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);

    // First listing has complete research
    expect(data[0].hasResearch).toBe(true);
    expect(data[0].researchStatus).toBe("complete");
    // Research relation is not included in the response
    expect(data[0].research).toBeUndefined();

    // Second listing has no research
    expect(data[1].hasResearch).toBe(false);
    expect(data[1].researchStatus).toBeNull();
  });

  it("returns empty array when no listings", async () => {
    prismaMock.listing.findMany.mockResolvedValue([] as never);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    prismaMock.listing.findMany.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
