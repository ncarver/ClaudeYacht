import { NextRequest, NextResponse } from "next/server";
import { selectReviews } from "@/lib/research";
import { parseListingId } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await parseListingId(params);
  if (result.error) return result.error;
  const { listingId } = result;

  const body = await request.json();
  const urls: string[] = Array.isArray(body.urls) ? body.urls : [];

  const ok = selectReviews(listingId, urls);
  if (!ok) {
    return NextResponse.json(
      { error: "No pending review selection for this listing" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
