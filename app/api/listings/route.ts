import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE() {
  const result = await prisma.listing.deleteMany();
  return NextResponse.json({ deleted: result.count });
}
