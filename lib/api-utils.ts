import { NextResponse } from "next/server";

type ParseResult =
  | { listingId: number; error?: undefined }
  | { listingId?: undefined; error: NextResponse };

export async function parseListingId(
  params: Promise<{ id: string }>
): Promise<ParseResult> {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return { error: NextResponse.json({ error: "Invalid ID" }, { status: 400 }) };
  }
  return { listingId };
}
