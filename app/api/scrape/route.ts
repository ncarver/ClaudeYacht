import { NextRequest, NextResponse } from "next/server";
import { startScrape, listPastScrapes } from "@/lib/scraper";
import type { ScrapeParams } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScrapeParams;

    // Basic validation
    if (!body.priceMin || !body.priceMax || !body.lengthMinFt || !body.lengthMaxFt) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    if (!body.outputFileName) {
      return NextResponse.json(
        { error: "Missing output file name" },
        { status: 400 }
      );
    }

    const status = startScrape(body);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const statusCode = message.includes("already running") ? 409 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function GET() {
  const files = listPastScrapes();
  return NextResponse.json(files);
}
