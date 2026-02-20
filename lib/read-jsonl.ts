import fs from "fs";
import type { Listing } from "./types";

export function parseJsonlLines<T = Listing>(
  content: string
): { parsed: T[]; errors: number } {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const parsed: T[] = [];
  let errors = 0;

  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line) as T);
    } catch {
      errors++;
    }
  }

  return { parsed, errors };
}

export function readJsonl(filePath: string): Listing[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return parseJsonlLines<Listing>(content).parsed;
}
