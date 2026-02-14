import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const listings = await prisma.listing.findMany({
    orderBy: { dateLoaded: "desc" },
  });

  return NextResponse.json(listings);
}
