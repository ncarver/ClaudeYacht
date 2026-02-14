import { NextRequest, NextResponse } from "next/server";
import { ingestFile } from "@/lib/ingest";

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json();
    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { error: "Missing fileName in request body" },
        { status: 400 }
      );
    }
    const result = await ingestFile(fileName);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
