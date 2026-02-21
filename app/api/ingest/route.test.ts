import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/ingest", () => ({
  ingestFile: vi.fn(),
}));

import { ingestFile } from "@/lib/ingest";
const mockIngestFile = vi.mocked(ingestFile);

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ingest", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/ingest", () => {
  it("ingests a valid file", async () => {
    mockIngestFile.mockResolvedValue({
      total: 10,
      inserted: 8,
      skipped: 2,
      errors: 0,
    });

    const res = await POST(createRequest({ fileName: "test.jsonl" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.inserted).toBe(8);
    expect(data.skipped).toBe(2);
    expect(mockIngestFile).toHaveBeenCalledWith("test.jsonl");
  });

  it("returns 400 for missing fileName", async () => {
    const res = await POST(createRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("fileName");
  });

  it("returns 400 for non-string fileName", async () => {
    const res = await POST(createRequest({ fileName: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when ingest fails", async () => {
    mockIngestFile.mockRejectedValue(new Error("File not found: bad.jsonl"));

    const res = await POST(createRequest({ fileName: "bad.jsonl" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("File not found");
  });
});
