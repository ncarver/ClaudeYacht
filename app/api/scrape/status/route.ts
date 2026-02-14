import { NextResponse } from "next/server";
import { getScrapeStatus } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getScrapeStatus();
  return NextResponse.json(status);
}
