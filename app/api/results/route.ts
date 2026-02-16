import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const listings = await prisma.listing.findMany({
    orderBy: { dateLoaded: "desc" },
    include: {
      research: { select: { status: true } },
    },
  });

  const result = listings.map((l) => {
    const { research, ...rest } = l;
    return {
      ...rest,
      hasResearch: research?.status === "complete",
      researchStatus: research?.status ?? null,
    };
  });

  return NextResponse.json(result);
}
