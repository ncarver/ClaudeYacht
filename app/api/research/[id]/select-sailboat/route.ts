import { NextRequest, NextResponse } from "next/server";
import { selectSailboat } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

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
