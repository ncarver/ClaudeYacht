import { NextRequest } from "next/server";
import { POST, GET } from "./route";

vi.mock("@/lib/scraper", () => ({
  startScrape: vi.fn(),
  listPastScrapes: vi.fn(),
}));

import { startScrape, listPastScrapes } from "@/lib/scraper";
const mockStartScrape = vi.mocked(startScrape);
const mockListPastScrapes = vi.mocked(listPastScrapes);

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/scrape", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  priceMin: 10000,
  priceMax: 100000,
  lengthMinFt: 37,
  lengthMaxFt: 42,
  condition: "used",
  excludeKetchYawl: false,
  excludeMultihull: false,
  outputFileName: "test-scrape.jsonl",
};

describe("POST /api/scrape", () => {
  it("starts a scrape with valid params", async () => {
    mockStartScrape.mockReturnValue({
      running: true,
      startedAt: "2025-01-01T00:00:00Z",
      outputFile: "test-scrape.jsonl",
      error: null,
    });

    const res = await POST(createPostRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.running).toBe(true);
  });

  it("returns 400 for missing required params", async () => {
    const res = await POST(createPostRequest({ priceMin: 10000 }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Missing");
  });

  it("returns 400 for missing output file name", async () => {
    const res = await POST(createPostRequest({
      priceMin: 10000,
      priceMax: 100000,
      lengthMinFt: 37,
      lengthMaxFt: 42,
    }));

    expect(res.status).toBe(400);
  });

  it("returns 409 when scrape is already running", async () => {
    mockStartScrape.mockImplementation(() => {
      throw new Error("Scrape already running");
    });

    const res = await POST(createPostRequest(validBody));
    expect(res.status).toBe(409);
  });

  it("returns 500 for unexpected errors", async () => {
    mockStartScrape.mockImplementation(() => {
      throw new Error("Unexpected failure");
    });

    const res = await POST(createPostRequest(validBody));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/scrape", () => {
  it("lists past scrape files", async () => {
    mockListPastScrapes.mockReturnValue([
      { fileName: "scrape-2025-01-15.jsonl", size: 1024, createdAt: "2025-01-15T00:00:00Z" },
    ] as never);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].fileName).toBe("scrape-2025-01-15.jsonl");
  });
});
