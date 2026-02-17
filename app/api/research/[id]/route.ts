import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { startResearch } from "@/lib/research";

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

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  try {
    const status = await startResearch(listingId);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("already running")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("Too many concurrent")) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const listingResearch = await prisma.listingResearch.findUnique({
    where: { listingId },
  });

  let modelResearch = null;
  if (listingResearch) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (listing?.manufacturer && listing?.boatClass) {
      modelResearch = await prisma.modelResearch.findFirst({
        where: {
          manufacturer: listing.manufacturer,
          boatClass: listing.boatClass,
        },
        orderBy: { researchedAt: "desc" },
      });
    }
  }

  return NextResponse.json({
    listing: listingResearch,
    model: modelResearch,
    capabilities: {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    },
  });
}
