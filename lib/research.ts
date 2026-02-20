import * as cheerio from "cheerio";

import prisma from "@/lib/prisma";
import type { SailboatDataSpecs, ResearchStatus, SailboatCandidate, ReviewCandidate, ReviewResult, ForumCandidate, ForumResult } from "@/lib/types";
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
  reviewCandidates: ReviewCandidate[] | null;
  resolveReviewSelection: ((selectedUrls: string[]) => void) | null;
  forumCandidates: ForumCandidate[] | null;
  resolveForumSelection: ((selectedUrls: string[]) => void) | null;
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
  if (job.status === "waiting_for_input" && job.reviewCandidates) {
    result.reviewCandidates = job.reviewCandidates;
  }
  if (job.status === "waiting_for_input" && job.forumCandidates) {
    result.forumCandidates = job.forumCandidates;
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

export function selectReviews(listingId: number, selectedUrls: string[]): boolean {
  const job = getState().jobs.get(listingId);
  if (!job || job.status !== "waiting_for_input" || !job.resolveReviewSelection) {
    return false;
  }
  job.resolveReviewSelection(selectedUrls);
  return true;
}

export function selectForums(listingId: number, selectedUrls: string[]): boolean {
  const job = getState().jobs.get(listingId);
  if (!job || job.status !== "waiting_for_input" || !job.resolveForumSelection) {
    return false;
  }
  job.resolveForumSelection(selectedUrls);
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
    reviewCandidates: null,
    resolveReviewSelection: null,
    forumCandidates: null,
    resolveForumSelection: null,
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

    // Step 1: YachtWorld listing description (per-listing, no API key needed)
    job.step = "yachtworld";
    let listingSummary: string | null = null;
    if (linkUrl) {
      try {
        listingSummary = await fetchListingDescription(linkUrl);
      } catch (err) {
        console.error("YachtWorld description fetch failed:", err);
      }
    }

    // Step 2: Sailboatdata.com (search-based with human-in-the-loop)
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

      // Step 2: Reviews search (DDG + human-in-the-loop)
      job.step = "reviews";
      let reviews: ReviewResult[] = [];
      try {
        reviews = await resolveReviews(job, listingName, manufacturer, boatClass);
      } catch (err) {
        console.error("Reviews search failed:", err);
      }

      // Step 3: Forum search (DDG + human-in-the-loop)
      job.step = "forums";
      let forums: ForumResult[] = [];
      try {
        forums = await resolveForums(job, listingName, manufacturer, boatClass);
      } catch (err) {
        console.error("Forum search failed:", err);
      }

      // Update ModelResearch
      await prisma.modelResearch.update({
        where: { id: modelResearch.id },
        data: {
          reviews: reviews.length > 0 ? JSON.stringify(reviews) : null,
          forums: forums.length > 0 ? JSON.stringify(forums) : null,
          researchedAt: new Date(),
        },
      });
    }

    // Finalize
    await prisma.listingResearch.update({
      where: { listingId },
      data: {
        status: "complete",
        listingSummary,
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
    // Brief delay to let WebKit fully release resources before next launch
    await new Promise((r) => setTimeout(r, 2000));
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

// ---- DuckDuckGo Search ----

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function ddgSearch(query: string): Promise<SearchResult[]> {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  console.log(`[research] DDG search: "${query}"`);

  const res = await fetch(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`[research] DDG search failed: ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  // Debug: log page structure to diagnose selector issues
  const linksDiv = $("#links");
  const resultElements = linksDiv.find(".result");
  console.log(`[research] DDG HTML length: ${html.length}, #links found: ${linksDiv.length}, .result elements: ${resultElements.length}`);

  // Try primary selectors
  resultElements.each((_, elem) => {
    const title = $(elem).find(".result__a").text().trim();
    const rawHref = $(elem).find(".result__a").attr("href") ?? "";
    const snippet = $(elem).find(".result__snippet").text().trim();

    // DDG wraps URLs in a redirect — extract the actual URL from the uddg parameter
    let url = rawHref;
    try {
      const parsed = new URL(rawHref, "https://duckduckgo.com");
      url = parsed.searchParams.get("uddg") ?? rawHref;
    } catch {
      // use rawHref as-is
    }

    if (title && url) {
      results.push({ title, url, snippet });
    }
  });

  // If primary selectors found nothing, log the first 500 chars and try alternate selectors
  if (results.length === 0 && html.length > 0) {
    console.log(`[research] DDG page title: "${$("title").text()}"`);
    // Try alternate selectors for DDG lite/no-JS results
    $("a.result-link, .results a.result__a, .web-result a").each((_, elem) => {
      const title = $(elem).text().trim();
      const rawHref = $(elem).attr("href") ?? "";
      if (title && rawHref && rawHref.startsWith("http")) {
        results.push({ title, url: rawHref, snippet: "" });
      }
    });
    if (results.length > 0) {
      console.log(`[research] DDG: found ${results.length} results with alternate selectors`);
    }
  }

  console.log(`[research] DDG search: ${results.length} results`);
  return results;
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---- Step 2: Reviews Search (DDG + Human-in-the-Loop) ----

async function resolveReviews(
  job: ResearchJob,
  listingName: string | null,
  manufacturer: string | null,
  boatClass: string | null
): Promise<ReviewResult[]> {
  // Use listing name (e.g. "Bavaria 42 Cruiser") if available, fall back to manufacturer+class
  const boatName = extractSearchKeyword(listingName)
    ?? `${manufacturer ?? ""} ${boatClass ?? ""}`.trim();
  if (!boatName) return [];

  // Broad search — user manually selects relevant reviews
  const query = `"${boatName}" sailboat review`;
  const results = await ddgSearch(query);

  if (results.length === 0) {
    console.log("[research] No review search results found");
    return [];
  }

  // Convert to ReviewCandidates
  const candidates: ReviewCandidate[] = results.map((r) => ({
    title: r.title,
    url: r.url,
    source: extractDomain(r.url),
    snippet: r.snippet,
  }));

  // Pause pipeline — wait for user to select which reviews to keep
  console.log(`[research] Pausing for review selection (${candidates.length} candidates)`);
  job.status = "waiting_for_input";
  job.step = "reviews";
  job.reviewCandidates = candidates;

  const selectedUrls = await new Promise<string[]>((resolve) => {
    job.resolveReviewSelection = resolve;
  });

  // Resume
  job.resolveReviewSelection = null;
  job.reviewCandidates = null;
  job.status = "running";
  job.step = "reviews";

  if (selectedUrls.length === 0) {
    console.log("[research] User skipped all reviews");
    return [];
  }

  // Build ReviewResult[] from the selected candidates
  const selected: ReviewResult[] = selectedUrls
    .map((url) => {
      const candidate = candidates.find((c) => c.url === url);
      if (!candidate) return null;
      return {
        title: candidate.title,
        source: candidate.source,
        url: candidate.url,
        excerpt: candidate.snippet,
      };
    })
    .filter((r): r is ReviewResult => r !== null);

  console.log(`[research] User selected ${selected.length} reviews`);
  return selected;
}

// ---- Step 3: Forum Search (DDG + Human-in-the-Loop) ----

async function resolveForums(
  job: ResearchJob,
  listingName: string | null,
  manufacturer: string | null,
  boatClass: string | null
): Promise<ForumResult[]> {
  const boatName = extractSearchKeyword(listingName)
    ?? `${manufacturer ?? ""} ${boatClass ?? ""}`.trim();
  if (!boatName) return [];

  const query = `"${boatName}" owners forum`;
  const results = await ddgSearch(query);

  if (results.length === 0) {
    console.log("[research] No forum search results found");
    return [];
  }

  const candidates: ForumCandidate[] = results.map((r) => ({
    title: r.title,
    url: r.url,
    source: extractDomain(r.url),
    snippet: r.snippet,
  }));

  console.log(`[research] Pausing for forum selection (${candidates.length} candidates)`);
  job.status = "waiting_for_input";
  job.step = "forums";
  job.forumCandidates = candidates;

  const selectedUrls = await new Promise<string[]>((resolve) => {
    job.resolveForumSelection = resolve;
  });

  job.resolveForumSelection = null;
  job.forumCandidates = null;
  job.status = "running";
  job.step = "forums";

  if (selectedUrls.length === 0) {
    console.log("[research] User skipped all forums");
    return [];
  }

  const selected: ForumResult[] = selectedUrls
    .map((url) => {
      const candidate = candidates.find((c) => c.url === url);
      if (!candidate) return null;
      return {
        title: candidate.title,
        source: candidate.source,
        url: candidate.url,
        excerpt: candidate.snippet,
      };
    })
    .filter((r): r is ForumResult => r !== null);

  console.log(`[research] User selected ${selected.length} forums`);
  return selected;
}

// ---- YachtWorld Listing Description (WebKit + Cheerio, no AI) ----

async function fetchListingDescription(
  linkUrl: string
): Promise<string | null> {
  const html = await fetchPageHtml(linkUrl);
  if (!html) {
    console.error("[research] YachtWorld listing fetch failed (no HTML)");
    return null;
  }

  const $ = cheerio.load(html);

  // YachtWorld uses an accordion: <details><summary>Description</summary><div class="data-html">...</div></details>
  let content: string | null = null;

  $("summary").each((_, el) => {
    if (content) return;
    const text = $(el).text().trim().toLowerCase();
    if (text === "description") {
      const descHtml = $(el).siblings(".data-html").first();
      const descText = descHtml.text().trim();
      if (descText && descText.length > 20) {
        content = descText;
      }
    }
  });

  if (!content) {
    console.warn("[research] Could not find listing description on page");
    return null;
  }

  const description = content as string;
  console.log(
    `[research] Description extracted, length: ${description.length} chars`
  );

  // Truncate to 350 characters
  const snippet = description.length > 350
    ? description.substring(0, 350).trimEnd() + "…"
    : description;

  console.log(`[research] Description snippet: ${snippet.length} chars`);
  return snippet;
}
