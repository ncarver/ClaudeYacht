import { NextRequest, NextResponse } from "next/server";
import { getResearchStatus } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const status = getResearchStatus(listingId);
  return NextResponse.json(status);
}
