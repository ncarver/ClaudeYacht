import type { SailboatCandidate, SailboatDataSpecs } from "@/lib/types";
import { defaultSailboatDataSpecs } from "@/lib/types";
import * as cheerio from "cheerio";

// ---- Keyword Extraction ----

export function extractSearchKeyword(listingName: string | null): string | null {
  if (!listingName) return null;
  // Strip leading 4-digit year (e.g., "2005 Dufour Classic 41" → "Dufour Classic 41")
  return listingName.replace(/^\d{4}\s+/, "").trim() || null;
}

export function buildFallbackKeyword(manufacturer: string | null, lengthInMeters: number | null): string | null {
  if (!manufacturer) return null;
  if (lengthInMeters) {
    const lengthFt = Math.round(lengthInMeters * 3.28084);
    return `${manufacturer} ${lengthFt}`;
  }
  return manufacturer;
}

// ---- Candidate Scoring ----

export interface SailboatDataContext {
  listingName: string | null;
  manufacturer: string | null;
  buildYear: number | null;
  lengthInMeters: number | null;
}

export function scoreCandidate(
  candidate: SailboatCandidate,
  context: SailboatDataContext
): number {
  let score = 0;
  const keyword = extractSearchKeyword(context.listingName)?.toUpperCase() ?? "";

  // Name similarity: exact match or containment
  const candidateUpper = candidate.modelName.toUpperCase();
  if (keyword && candidateUpper === keyword) {
    score += 100;
  } else if (keyword && candidateUpper.includes(keyword)) {
    score += 50;
  } else if (keyword) {
    // Check how many words from the keyword are in the candidate name
    const words = keyword.split(/\s+/);
    const matchedWords = words.filter((w) => candidateUpper.includes(w));
    score += (matchedWords.length / words.length) * 30;
  }

  // Year proximity
  if (context.buildYear && candidate.firstBuilt) {
    const candidateYear = parseInt(candidate.firstBuilt, 10);
    if (!isNaN(candidateYear)) {
      const yearDiff = Math.abs(candidateYear - context.buildYear);
      score += Math.max(0, 20 - yearDiff); // up to 20 points, decays with distance
    }
  }

  return score;
}

export function markRecommended(candidates: SailboatCandidate[], context: SailboatDataContext): void {
  if (candidates.length === 0) return;

  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const s = scoreCandidate(candidates[i], context);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  candidates[bestIdx].recommended = true;
}

// ---- Year Range Computation ----

export function computeYearRange(
  buildYear: number | null,
  sailboatDataYears?: { first: number | null; last: number | null }
): { yearMin: number | null; yearMax: number | null } {
  if (sailboatDataYears?.first || sailboatDataYears?.last) {
    return {
      yearMin: sailboatDataYears.first ?? sailboatDataYears.last,
      yearMax: sailboatDataYears.last ?? sailboatDataYears.first,
    };
  }
  if (buildYear) {
    const decadeStart = Math.floor(buildYear / 10) * 10;
    return { yearMin: decadeStart, yearMax: decadeStart + 9 };
  }
  return { yearMin: null, yearMax: null };
}

// ---- Domain Extraction ----

export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---- Sailboatdata HTML Parsing ----

export function parseSpecsFromHtml(
  $: cheerio.CheerioAPI
): SailboatDataSpecs {
  const specs = { ...defaultSailboatDataSpecs };

  function findValue(label: string): string | null {
    let value: string | null = null;

    // Pattern: <td>Label</td><td>Value</td>
    $("td, th").each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes(label.toLowerCase())) {
        const next = $(el).next("td");
        if (next.length) {
          value = next.text().trim() || null;
          return false; // break
        }
      }
    });

    if (value) return value;

    // Pattern: dt/dd pairs
    $("dt").each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes(label.toLowerCase())) {
        const dd = $(el).next("dd");
        if (dd.length) {
          value = dd.text().trim() || null;
          return false;
        }
      }
    });

    return value;
  }

  function parseNum(val: string | null): number | null {
    if (!val) return null;
    const cleaned = val.replace(/[,\s]/g, "").replace(/[^\d.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  specs.hullType = findValue("Hull Type");
  specs.rigging = findValue("Rigging");
  specs.construction = findValue("Construction");
  specs.displacement = parseNum(findValue("Displacement"));
  specs.ballast = parseNum(findValue("Ballast"));
  specs.loa = parseNum(findValue("LOA"));
  specs.lwl = parseNum(findValue("LWL"));
  specs.beam = parseNum(findValue("Beam"));
  specs.sailArea = parseNum(findValue("Sail Area"));
  specs.engine = findValue("Engine");
  specs.auxPowerMake = findValue("Make");
  specs.auxPowerModel = findValue("Model");
  specs.auxPowerFuel = findValue("Fuel");
  specs.water = parseNum(findValue("Water"));
  specs.designer = findValue("Designer") ?? findValue("Design");

  // Ratios
  specs.saDisplacement = parseNum(findValue("SA/Disp"));
  specs.ballastDisplacement = parseNum(findValue("Bal/Disp") ?? findValue("Ballast/Disp"));
  specs.displacementLength = parseNum(findValue("Disp/Len") ?? findValue("Disp/Length"));
  specs.comfortRatio = parseNum(findValue("Comfort"));
  specs.capsizeScreening = parseNum(findValue("Capsize"));

  // Draft (may be a range like "4.5 / 6.5")
  const draftVal = findValue("Draft");
  if (draftVal) {
    const draftParts = draftVal.split("/").map((s) => parseNum(s.trim()));
    if (draftParts.length >= 2) {
      specs.draftMin = draftParts[0];
      specs.draftMax = draftParts[1];
    } else {
      specs.draftMin = draftParts[0];
      specs.draftMax = draftParts[0];
    }
  }

  // Production years
  specs.firstBuilt = parseNum(findValue("First Built") ?? findValue("Year"));
  specs.lastBuilt = parseNum(findValue("Last Built"));
  specs.numberOfBoats = parseNum(findValue("# Built") ?? findValue("Number Built"));

  return specs;
}
