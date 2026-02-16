import path from "path";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import type { SailboatDataSpecs, ResearchStatus, SailboatCandidate } from "@/lib/types";
import { defaultSailboatDataSpecs } from "@/lib/types";

// ---- Async Mutex for Playwright serialization ----

class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

// ---- State Management (globalThis singleton) ----

interface ResearchJob {
  listingId: number;
  status: "pending" | "running" | "waiting_for_input" | "complete" | "failed";
  step: string | null;
  errorMessage: string | null;
  candidates: SailboatCandidate[] | null;
  resolveSelection: ((slug: string | null) => void) | null;
}

interface ResearchState {
  jobs: Map<number, ResearchJob>;
}

declare global {
  var researchState: ResearchState | undefined;
  var playwrightMutex: AsyncMutex | undefined;
}

function getState(): ResearchState {
  if (!globalThis.researchState) {
    globalThis.researchState = { jobs: new Map() };
  }
  return globalThis.researchState;
}

function getMutex(): AsyncMutex {
  if (!globalThis.playwrightMutex) {
    globalThis.playwrightMutex = new AsyncMutex();
  }
  return globalThis.playwrightMutex;
}

const MAX_CONCURRENT_RESEARCH = 3;

// ---- Exported Functions ----

export function getResearchStatus(listingId: number): ResearchStatus {
  const state = getState();
  const job = state.jobs.get(listingId);
  if (!job) {
    return { listingId, status: "pending", step: null, errorMessage: null };
  }
  const result: ResearchStatus = {
    listingId,
    status: job.status,
    step: job.step,
    errorMessage: job.errorMessage,
  };
  if (job.status === "waiting_for_input" && job.candidates) {
    result.candidates = job.candidates;
  }
  return result;
}

export function selectSailboat(listingId: number, slug: string | null): boolean {
  const job = getState().jobs.get(listingId);
  if (!job || job.status !== "waiting_for_input" || !job.resolveSelection) {
    return false;
  }
  job.resolveSelection(slug);
  return true;
}

export async function startResearch(listingId: number): Promise<ResearchStatus> {
  const state = getState();

  const existing = state.jobs.get(listingId);
  if (existing && (existing.status === "running" || existing.status === "waiting_for_input")) {
    throw new Error("Research already running for this listing");
  }

  const runningCount = [...state.jobs.values()].filter(
    (j) => j.status === "running" || j.status === "waiting_for_input"
  ).length;
  if (runningCount >= MAX_CONCURRENT_RESEARCH) {
    throw new Error("Too many concurrent research jobs");
  }

  const job: ResearchJob = {
    listingId,
    status: "running",
    step: null,
    errorMessage: null,
    candidates: null,
    resolveSelection: null,
  };
  state.jobs.set(listingId, job);

  // Upsert ListingResearch row as "running"
  await prisma.listingResearch.upsert({
    where: { listingId },
    create: { listingId, status: "running" },
    update: { status: "running", errorMessage: null },
  });

  // Fire and forget
  runPipeline(listingId, job).catch((err) => {
    console.error(`Research pipeline error for listing ${listingId}:`, err);
  });

  return getResearchStatus(listingId);
}

// ---- Pipeline ----

async function runPipeline(listingId: number, job: ResearchJob) {
  try {
    const listing = await prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
    });
    const { manufacturer, boatClass, buildYear, linkUrl, listingName, lengthInMeters } = listing;

    // Step 1: Sailboatdata.com (search-based with human-in-the-loop)
    job.step = "sailboatdata";
    let sailboatDataSpecs: SailboatDataSpecs | null = null;
    try {
      sailboatDataSpecs = await resolveSailboatData(job, {
        listingName,
        manufacturer,
        buildYear,
        lengthInMeters,
      });
      if (sailboatDataSpecs) {
        const nonNullFields = Object.entries(sailboatDataSpecs).filter(([, v]) => v !== null).length;
        console.log(`[research] Sailboatdata: found ${nonNullFields} fields`);
      } else {
        console.log("[research] Sailboatdata: no specs (skipped or no match)");
      }
    } catch (err) {
      console.error("[research] Sailboatdata step failed:", err);
    }

    // Compute year range
    const yearRange = computeYearRange(
      buildYear,
      sailboatDataSpecs
        ? { first: sailboatDataSpecs.firstBuilt, last: sailboatDataSpecs.lastBuilt }
        : undefined
    );

    // Check for existing ModelResearch
    const mfr = manufacturer ?? "Unknown";
    const cls = boatClass ?? "Unknown";
    let modelResearch = await prisma.modelResearch.findUnique({
      where: {
        manufacturer_boatClass_yearMin_yearMax: {
          manufacturer: mfr,
          boatClass: cls,
          yearMin: yearRange.yearMin ?? 0,
          yearMax: yearRange.yearMax ?? 0,
        },
      },
    });

    if (!modelResearch) {
      // Create with sailboatdata
      modelResearch = await prisma.modelResearch.create({
        data: {
          manufacturer: mfr,
          boatClass: cls,
          yearMin: yearRange.yearMin,
          yearMax: yearRange.yearMax,
          sailboatData: sailboatDataSpecs
            ? JSON.stringify(sailboatDataSpecs)
            : null,
        },
      });

      // Step 2: Reviews search (disabled — focusing on sailboatdata)
      // job.step = "reviews";
      // let reviews: { title: string; source: string; url: string; excerpt: string }[] = [];
      // try {
      //   reviews = await searchReviews(manufacturer, boatClass, yearRange);
      // } catch (err) {
      //   console.error("Reviews search failed:", err);
      // }

      // Step 3: Forum search (disabled — focusing on sailboatdata)
      // job.step = "forums";
      // let forum: { name: string; url: string } | null = null;
      // try {
      //   forum = await searchForums(manufacturer, boatClass);
      // } catch (err) {
      //   console.error("Forum search failed:", err);
      // }

      // Update ModelResearch
      await prisma.modelResearch.update({
        where: { id: modelResearch.id },
        data: {
          researchedAt: new Date(),
        },
      });
    }

    // Step 4: YachtWorld listing summary (disabled — focusing on sailboatdata)
    // job.step = "yachtworld";
    // let listingSummary: string | null = null;
    // if (linkUrl) {
    //   try {
    //     listingSummary = await fetchAndSummarizeListing(linkUrl);
    //   } catch (err) {
    //     console.error("YachtWorld summary failed:", err);
    //   }
    // }

    // Finalize
    await prisma.listingResearch.update({
      where: { listingId },
      data: {
        status: "complete",
        researchedAt: new Date(),
      },
    });

    job.status = "complete";
    job.step = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    job.status = "failed";
    job.errorMessage = message;
    job.step = null;

    await prisma.listingResearch
      .update({
        where: { listingId },
        data: { status: "failed", errorMessage: message },
      })
      .catch(() => {}); // Don't throw on cleanup failure
  }
}

// ---- Step 1: Sailboatdata.com (search-based with human-in-the-loop) ----

interface SailboatDataContext {
  listingName: string | null;
  manufacturer: string | null;
  buildYear: number | null;
  lengthInMeters: number | null;
}

function extractSearchKeyword(listingName: string | null): string | null {
  if (!listingName) return null;
  // Strip leading 4-digit year (e.g., "2005 Dufour Classic 41" → "Dufour Classic 41")
  return listingName.replace(/^\d{4}\s+/, "").trim() || null;
}

function buildFallbackKeyword(manufacturer: string | null, lengthInMeters: number | null): string | null {
  if (!manufacturer) return null;
  if (lengthInMeters) {
    const lengthFt = Math.round(lengthInMeters * 3.28084);
    return `${manufacturer} ${lengthFt}`;
  }
  return manufacturer;
}

// ---- Playwright page fetcher (bypasses Cloudflare) ----

async function fetchPageHtml(url: string): Promise<string | null> {
  const mutex = getMutex();
  await mutex.acquire();

  let browser;
  try {
    const { webkit } = require("playwright");

    console.log(`[research] Launching WebKit for ${url}`);
    browser = await webkit.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check for Cloudflare block
    const pageTitle: string = await page.title();
    if (
      pageTitle.toLowerCase().includes("attention required") ||
      pageTitle.toLowerCase().includes("just a moment") ||
      pageTitle.toLowerCase().includes("challenge")
    ) {
      console.error("[research] Cloudflare blocked WebKit request");
      await browser.close();
      browser = null;
      return null;
    }

    const html: string = await page.content();
    await browser.close();
    browser = null;
    return html;
  } catch (err) {
    console.error(`[research] WebKit fetch failed for ${url}:`, err);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return null;
  } finally {
    mutex.release();
  }
}

// Returns null on fetch failure (403, network error), [] on success with no results
async function searchSailboatData(keyword: string): Promise<SailboatCandidate[] | null> {
  const url = `https://sailboatdata.com/?keyword=${encodeURIComponent(keyword)}&sort-select=&sailboats_per_page=25`;
  console.log(`[research] Searching sailboatdata.com for "${keyword}"...`);

  const html = await fetchPageHtml(url);
  if (!html) {
    console.error(`[research] Sailboatdata search failed (Playwright returned no content)`);
    return null; // null = fetch failed (don't cache)
  }

  const $ = cheerio.load(html);
  const candidates: SailboatCandidate[] = [];

  // Parse the search results table rows
  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const modelCell = cells.eq(0);
    const link = modelCell.find("a");
    const modelName = link.text().trim() || modelCell.text().trim();
    if (!modelName) return;

    // Extract slug from href like "/sailboat/dufour-classic-41/"
    const href = link.attr("href") ?? "";
    const slugMatch = href.match(/\/sailboat\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : "";
    if (!slug) return;

    const loa = cells.eq(1).text().trim() || null;
    const firstBuilt = cells.eq(2).text().trim() || null;

    candidates.push({
      modelName,
      slug,
      loa,
      firstBuilt,
      recommended: false,
    });
  });

  console.log(`[research] Found ${candidates.length} candidates`);
  return candidates;
}

function scoreCandidate(
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

function markRecommended(candidates: SailboatCandidate[], context: SailboatDataContext): void {
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

async function fetchSailboatDataBySlug(slug: string): Promise<SailboatDataSpecs | null> {
  const url = `https://sailboatdata.com/sailboat/${slug}`;
  console.log(`[research] Fetching sailboatdata specs for slug "${slug}"...`);

  const html = await fetchPageHtml(url);
  if (!html) return null;

  const $ = cheerio.load(html);
  const specs = parseSpecsFromHtml($);
  specs.sailboatDataUrl = url;
  return specs;
}

async function resolveSailboatData(
  job: ResearchJob,
  context: SailboatDataContext
): Promise<SailboatDataSpecs | null> {
  // Extract search keyword from listing name
  const keyword = extractSearchKeyword(context.listingName);
  if (!keyword) {
    console.log("[research] No listing name available, skipping sailboatdata");
    return null;
  }
  const searchKey = keyword.toLowerCase();

  // Check cache
  const cached = await prisma.sailboatDataMapping.findUnique({
    where: { searchKey },
  });
  if (cached) {
    if (cached.sailboatSlug) {
      console.log(`[research] Cache hit: "${searchKey}" → ${cached.sailboatSlug}`);
      return fetchSailboatDataBySlug(cached.sailboatSlug);
    }
    console.log(`[research] Cache hit: "${searchKey}" → none (user skipped)`);
    return null;
  }

  // Search sailboatdata.com (null = fetch failed, [] = no results)
  let candidates = await searchSailboatData(keyword);

  // Fallback: try manufacturer + length
  if (!candidates || candidates.length === 0) {
    const fallback = buildFallbackKeyword(context.manufacturer, context.lengthInMeters);
    if (fallback && fallback.toLowerCase() !== keyword.toLowerCase()) {
      console.log(`[research] No results for "${keyword}", trying fallback "${fallback}"...`);
      const fallbackResult = await searchSailboatData(fallback);
      if (fallbackResult !== null) candidates = fallbackResult;
    }
  }

  // If all searches failed (403, network error), don't cache — allow retry
  if (candidates === null) {
    console.log("[research] Sailboatdata search failed, will retry next time");
    return null;
  }

  // Search succeeded but no results — cache as "no match"
  if (candidates.length === 0) {
    console.log("[research] No sailboatdata candidates found, saving as skipped");
    await prisma.sailboatDataMapping.create({
      data: { searchKey, sailboatSlug: null, modelName: null },
    });
    return null;
  }

  // Score and mark recommended
  markRecommended(candidates, context);

  // Pause pipeline — wait for user selection
  console.log(`[research] Pausing for user selection (${candidates.length} candidates)`);
  job.status = "waiting_for_input";
  job.candidates = candidates;

  const selectedSlug = await new Promise<string | null>((resolve) => {
    job.resolveSelection = resolve;
  });

  // Resume
  job.resolveSelection = null;
  job.candidates = null;
  job.status = "running";
  job.step = "sailboatdata";

  // Save the choice
  const selectedCandidate = selectedSlug
    ? candidates.find((c) => c.slug === selectedSlug)
    : null;
  await prisma.sailboatDataMapping.create({
    data: {
      searchKey,
      sailboatSlug: selectedSlug,
      modelName: selectedCandidate?.modelName ?? null,
    },
  });

  if (!selectedSlug) {
    console.log("[research] User selected 'none', skipping sailboatdata");
    return null;
  }

  console.log(`[research] User selected: ${selectedSlug}`);
  return fetchSailboatDataBySlug(selectedSlug);
}

function parseSpecsFromHtml(
  $: cheerio.CheerioAPI
): SailboatDataSpecs {
  const specs = { ...defaultSailboatDataSpecs };

  function findValue(label: string): string | null {
    // Sailboatdata uses various patterns -- try multiple selectors
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

// ---- Year Range Computation ----

function computeYearRange(
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

// ---- Step 2: Reviews Search (Brave + Claude) ----

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

async function braveSearch(
  query: string,
  apiKey: string
): Promise<BraveSearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");

  const res = await fetch(url.toString(), {
    headers: {
      "X-Subscription-Token": apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`Brave search failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();
  return (data.web?.results ?? []).map(
    (r: { title?: string; url?: string; description?: string; extra_snippets?: string[] }) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      description: [r.description, ...(r.extra_snippets ?? [])]
        .filter(Boolean)
        .join(" "),
    })
  );
}

function getAnthropicClient(): Anthropic {
  return new Anthropic();
}

async function searchReviews(
  manufacturer: string | null,
  boatClass: string | null,
  yearRange: { yearMin: number | null; yearMax: number | null }
): Promise<{ title: string; source: string; url: string; excerpt: string }[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("BRAVE_SEARCH_API_KEY not set, skipping review search");
    return [];
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.warn("ANTHROPIC_API_KEY not set, skipping review evaluation");
    return [];
  }

  const boatName = `${manufacturer ?? ""} ${boatClass ?? ""}`.trim();
  if (!boatName) return [];

  const query = `"${boatName}" sailboat review site:practical-sailor.com OR site:sailmagazine.com OR site:cruisingworld.com OR site:yachtingmonthly.com OR site:bfriedman.net`;
  const braveResults = await braveSearch(query, apiKey);

  if (braveResults.length === 0) {
    // Try a broader search
    const broadQuery = `"${boatName}" sailboat review`;
    const broadResults = await braveSearch(broadQuery, apiKey);
    if (broadResults.length === 0) return [];
    return evaluateReviews(boatName, yearRange, broadResults);
  }

  return evaluateReviews(boatName, yearRange, braveResults);
}

async function evaluateReviews(
  boatName: string,
  yearRange: { yearMin: number | null; yearMax: number | null },
  results: BraveSearchResult[]
): Promise<{ title: string; source: string; url: string; excerpt: string }[]> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `I'm researching the ${boatName}${yearRange.yearMin ? ` (${yearRange.yearMin}s era)` : ""}.

Here are search results for professional reviews:
${results.map((r, i) => `${i + 1}. "${r.title}" - ${r.url}\n   ${r.description}`).join("\n\n")}

Return a JSON array of the most relevant professional reviews (up to 5). Each entry should have:
- title: the article title
- source: the publication name (e.g., "Practical Sailor")
- url: the full URL
- excerpt: a 1-2 sentence summary of what the review covers

Return ONLY the JSON array, no other text. If none are relevant reviews, return [].`,
      },
    ],
  });

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

// ---- Step 3: Forum Search (Brave + Claude) ----

async function searchForums(
  manufacturer: string | null,
  boatClass: string | null
): Promise<{ name: string; url: string } | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return null;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return null;

  const boatName = `${manufacturer ?? ""} ${boatClass ?? ""}`.trim();
  if (!boatName) return null;

  const query = `"${boatName}" owners association OR owners group OR forum`;
  const results = await braveSearch(query, apiKey);

  if (results.length === 0) return null;

  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Find the official owners association, dedicated forum, or owners group for the ${boatName} sailboat from these search results:
${results.map((r, i) => `${i + 1}. "${r.title}" - ${r.url}\n   ${r.description}`).join("\n\n")}

If you find a dedicated owners group, association, or forum, return JSON: {"name": "Forum Name", "url": "https://..."}
If none exists, return null.
Return ONLY the JSON or null, no other text.`,
      },
    ],
  });

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    return null;
  }
}

// ---- Step 4: YachtWorld Listing Summary (Playwright + Claude) ----

async function fetchAndSummarizeListing(
  linkUrl: string
): Promise<string | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.warn("[research] ANTHROPIC_API_KEY not set, skipping listing summary");
    return null;
  }

  const mutex = getMutex();
  await mutex.acquire();

  let context;
  try {
    const { chromium } = require("playwright-extra");
    const stealth = require("puppeteer-extra-plugin-stealth")();
    chromium.use(stealth);

    // Use the main browser profile (has Cloudflare cookies from scraping).
    // The mutex prevents concurrent Playwright usage within the research agent.
    // If the scraper is also running, Playwright will fail to lock the profile
    // and we'll catch that error gracefully.
    const userDataDir = path.join(process.cwd(), ".browser-profile");

    console.log(`[research] Launching Playwright for ${linkUrl}`);
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1440, height: 900 },
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const page = context.pages()[0] || (await context.newPage());
    console.log("[research] Navigating to listing page...");
    await page.goto(linkUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check if we hit a Cloudflare challenge
    const pageTitle: string = await page.title();
    const pageUrl: string = page.url();
    console.log(`[research] Page loaded — title: "${pageTitle}", url: ${pageUrl}`);

    if (
      pageTitle.toLowerCase().includes("just a moment") ||
      pageTitle.toLowerCase().includes("attention required") ||
      pageTitle.toLowerCase().includes("challenge")
    ) {
      console.warn("[research] Cloudflare challenge detected, waiting 10s for resolution...");
      await page.waitForTimeout(10000);
      const newTitle: string = await page.title();
      console.log(`[research] After wait — title: "${newTitle}"`);
      if (
        newTitle.toLowerCase().includes("just a moment") ||
        newTitle.toLowerCase().includes("challenge")
      ) {
        console.error("[research] Cloudflare challenge not resolved. Cannot fetch listing.");
        await context.close();
        context = null;
        return null;
      }
    }

    // Scroll down to load lazy content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const { content, matchedSelector }: { content: string; matchedSelector: string } =
      await page.evaluate(() => {
        // Try specific YachtWorld selectors first
        const selectors = [
          '[data-e2e="listing-description"]',
          ".listing-description",
          ".boat-description",
          '[class*="description"]',
          '[class*="Description"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent && el.textContent.trim().length > 100) {
            return { content: el.textContent.trim(), matchedSelector: sel };
          }
        }
        // Fallback: grab the main content area text
        const main = document.querySelector("main") ?? document.body;
        return {
          content: main.innerText.substring(0, 8000),
          matchedSelector: "fallback (main/body)",
        };
      });

    console.log(
      `[research] Content extracted — selector: "${matchedSelector}", length: ${content.length} chars`
    );

    await context.close();
    context = null;

    if (!content || content.length < 50) {
      console.warn(`[research] Content too short (${content.length} chars), skipping summary`);
      return null;
    }

    console.log("[research] Sending to Claude for summarization...");
    const summary = await summarizeWithClaude(content, linkUrl);
    console.log(`[research] Summary generated (${summary.length} chars)`);
    return summary;
  } catch (err) {
    console.error("[research] Failed to fetch/summarize listing:", err);
    if (context) {
      await context.close().catch(() => {});
    }
    return null;
  } finally {
    mutex.release();
  }
}

async function summarizeWithClaude(
  content: string,
  url: string
): Promise<string> {
  const anthropic = getAnthropicClient();
  const truncated = content.substring(0, 8000);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Summarize this YachtWorld sailboat listing in 3-5 sentences. Focus on: condition, key equipment/upgrades, notable features, and anything a buyer should know. Be factual and concise.

Listing URL: ${url}

Listing content:
${truncated}`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
