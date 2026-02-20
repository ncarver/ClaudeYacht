import { NextResponse } from "next/server";
import { readdir, unlink } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

export async function DELETE() {
  // 1. Delete all listings from the database
  const result = await prisma.listing.deleteMany();

  // 2. Delete all .jsonl files from the data directory
  let deletedFiles = 0;
  const dataDir = path.join(process.cwd(), "data");
  try {
    const files = await readdir(dataDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
    await Promise.all(
      jsonlFiles.map((f) => unlink(path.join(dataDir, f)))
    );
    deletedFiles = jsonlFiles.length;
  } catch {
    // data directory may not exist — that's fine
  }

  return NextResponse.json({
    deleted: result.count,
    deletedFiles,
  });
}
