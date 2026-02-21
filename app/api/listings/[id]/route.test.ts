import { NextRequest } from "next/server";
import { PATCH } from "./route";
import prismaMock from "@/lib/__mocks__/prisma";

vi.mock("@/lib/prisma", () => import("@/lib/__mocks__/prisma"));

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/listings/1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function createParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/listings/[id]", () => {
  it("updates notes field", async () => {
    prismaMock.listing.update.mockResolvedValue({
      id: 1,
      notes: "Great boat",
    } as never);

    const res = await PATCH(createRequest({ notes: "Great boat" }), createParams("1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toBe("Great boat");
    expect(prismaMock.listing.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { notes: "Great boat" },
    });
  });

  it("updates thumbs to 'up'", async () => {
    prismaMock.listing.update.mockResolvedValue({ id: 1, thumbs: "up" } as never);

    const res = await PATCH(createRequest({ thumbs: "up" }), createParams("1"));
    expect(res.status).toBe(200);
  });

  it("updates thumbs to null", async () => {
    prismaMock.listing.update.mockResolvedValue({ id: 1, thumbs: null } as never);

    const res = await PATCH(createRequest({ thumbs: null }), createParams("1"));
    expect(res.status).toBe(200);
  });

  it("rejects invalid thumbs value", async () => {
    const res = await PATCH(createRequest({ thumbs: "sideways" }), createParams("1"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("thumbs");
  });

  it("rejects non-whitelisted fields", async () => {
    const res = await PATCH(
      createRequest({ priceUSD: 999999 }),
      createParams("1")
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("No valid fields");
  });

  it("allows multiple whitelisted fields", async () => {
    prismaMock.listing.update.mockResolvedValue({
      id: 1,
      notes: "test",
      favorite: true,
    } as never);

    const res = await PATCH(
      createRequest({ notes: "test", favorite: true }),
      createParams("1")
    );

    expect(res.status).toBe(200);
    expect(prismaMock.listing.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { notes: "test", favorite: true },
    });
  });

  it("strips non-whitelisted fields while keeping valid ones", async () => {
    prismaMock.listing.update.mockResolvedValue({ id: 1, notes: "test" } as never);

    const res = await PATCH(
      createRequest({ notes: "test", priceUSD: 999 }),
      createParams("1")
    );

    expect(res.status).toBe(200);
    expect(prismaMock.listing.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { notes: "test" },
    });
  });

  it("returns 400 for invalid ID", async () => {
    const res = await PATCH(createRequest({ notes: "test" }), createParams("abc"));
    expect(res.status).toBe(400);
  });
});
