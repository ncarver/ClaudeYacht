import fs from "fs";
import path from "path";
import type { ScrapeFileInfo } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

export function getDataDir(): string {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return DATA_DIR;
}

export function listJsonlFiles(): ScrapeFileInfo[] {
  const dir = getDataDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));

  return files
    .map((fileName) => {
      const stat = fs.statSync(path.join(dir, fileName));
      return {
        fileName,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getLatestFile(): string | null {
  const files = listJsonlFiles();
  if (files.length === 0) return null;
  return path.join(getDataDir(), files[0].fileName);
}

export function getFilePath(fileName: string): string | null {
  const filePath = path.join(getDataDir(), path.basename(fileName));
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}
