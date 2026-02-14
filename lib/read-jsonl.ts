import fs from "fs";
import type { Listing } from "./types";

export function readJsonl(filePath: string): Listing[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const listings: Listing[] = [];

  for (const line of lines) {
    try {
      listings.push(JSON.parse(line) as Listing);
    } catch {
      // Skip malformed lines
    }
  }

  return listings;
}
