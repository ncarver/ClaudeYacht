import fs from "fs";
import path from "path";
import prisma from "./prisma";
import { getDataDir } from "./data-dir";
import { parseJsonlLines } from "./read-jsonl";

interface RawListing {
  listingName: string | null;
  sellerName: string | null;
  sellerLocation: string | null;
  imgUrl: string | null;
  linkUrl: string | null;
  manufacturer: string | null;
  boatClass: string | null;
  lengthInMeters: number | null;
  state: string | null;
  priceUSD: number | null;
}

export interface IngestResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: number;
}

const YEAR_REGEX = /^(\d{4})\s+(.+)$/;

export function parseBuildYear(listingName: string | null): {
  buildYear: number | null;
  name: string | null;
} {
  if (!listingName) return { buildYear: null, name: null };
  const match = listingName.match(YEAR_REGEX);
  if (match) {
    return { buildYear: parseInt(match[1], 10), name: match[2].trim() };
  }
  return { buildYear: null, name: listingName };
}

export async function ingestFile(fileName: string): Promise<IngestResult> {
  const filePath = path.join(getDataDir(), path.basename(fileName));
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${fileName}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { parsed: rawListings, errors: parseErrors } =
    parseJsonlLines<RawListing>(content);

  let inserted = 0;
  let skipped = 0;
  let errors = parseErrors;

  for (const raw of rawListings) {
    if (!raw.linkUrl) {
      errors++;
      continue;
    }

    const existing = await prisma.listing.findUnique({
      where: { linkUrl: raw.linkUrl },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const { buildYear, name } = parseBuildYear(raw.listingName);

    await prisma.listing.create({
      data: {
        linkUrl: raw.linkUrl,
        buildYear,
        listingName: name,
        sellerName: raw.sellerName,
        sellerLocation: raw.sellerLocation,
        imgUrl: raw.imgUrl,
        manufacturer: raw.manufacturer,
        boatClass: raw.boatClass,
        lengthInMeters: raw.lengthInMeters,
        state: raw.state,
        priceUSD: raw.priceUSD != null ? Math.round(raw.priceUSD) : null,
        fileSource: path.basename(fileName),
        dateLoaded: new Date(),
      },
    });

    inserted++;
  }

  return { total: rawListings.length + parseErrors, inserted, skipped, errors };
}
