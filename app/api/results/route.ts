import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
  } catch (err) {
    console.error("GET /api/results failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    );
  }
}
