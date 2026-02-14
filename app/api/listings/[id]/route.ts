import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json();
  const allowedFields = ["notes", "thumbs", "favorite", "properties"];
  const data: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      data[field] = body[field];
    }
  }

  if (
    "thumbs" in data &&
    data.thumbs !== null &&
    data.thumbs !== "up" &&
    data.thumbs !== "down"
  ) {
    return NextResponse.json(
      { error: "thumbs must be 'up', 'down', or null" },
      { status: 400 }
    );
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const listing = await prisma.listing.update({
    where: { id: listingId },
    data,
  });

  return NextResponse.json(listing);
}
