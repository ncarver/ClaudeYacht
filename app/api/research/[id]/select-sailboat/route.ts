import { NextRequest, NextResponse } from "next/server";
import { selectSailboat } from "@/lib/research";
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
  const slug: string | null = body.slug ?? null;

  const ok = selectSailboat(listingId, slug);
  if (!ok) {
    return NextResponse.json(
      { error: "No pending selection for this listing" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
