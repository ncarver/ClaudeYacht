const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const YEAR_REGEX = /^(\d{4})\s+(.+)$/;

async function main() {
  const filePath = path.join(__dirname, "..", "data", "yachtworld_results.jsonl");
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  let inserted = 0;
  let skipped = 0;

  for (const line of lines) {
    const raw = JSON.parse(line);
    if (!raw.linkUrl) continue;

    const existing = await prisma.listing.findUnique({
      where: { linkUrl: raw.linkUrl },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const match = (raw.listingName || "").match(YEAR_REGEX);
    const buildYear = match ? parseInt(match[1], 10) : null;
    const listingName = match ? match[2].trim() : raw.listingName;

    await prisma.listing.create({
      data: {
        linkUrl: raw.linkUrl,
        buildYear,
        listingName,
        sellerName: raw.sellerName,
        sellerLocation: raw.sellerLocation,
        imgUrl: raw.imgUrl,
        manufacturer: raw.manufacturer,
        boatClass: raw.boatClass,
        lengthInMeters: raw.lengthInMeters,
        state: raw.state,
        priceUSD: raw.priceUSD != null ? Math.round(raw.priceUSD) : null,
        fileSource: "yachtworld_results.jsonl",
        dateLoaded: new Date(),
      },
    });
    inserted++;
  }

  console.log(`Inserted: ${inserted}, Skipped: ${skipped}, Total: ${lines.length}`);
  await prisma.$disconnect();
}

main().catch(console.error);
