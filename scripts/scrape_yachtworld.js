const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

// Apply stealth plugin to avoid Cloudflare detection
chromium.use(stealth);

// Parse CLI arguments (--key value pairs), falling back to original defaults
const cliArgs = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  cliArgs[key] = process.argv[i + 1];
}

const priceMin = cliArgs.priceMin || '10000';
const priceMax = cliArgs.priceMax || '100000';
const lengthMinFt = cliArgs.lengthMinFt || '37';
const lengthMaxFt = cliArgs.lengthMaxFt || '42';
const condition = cliArgs.condition || 'used'; // 'used', 'new', or 'any'
const excludeKetchYawl = cliArgs.excludeKetchYawl !== 'false'; // default true
const excludeMultihull = cliArgs.excludeMultihull !== 'false'; // default true
const headless = cliArgs.headless === 'true'; // default false (headed)

const PROJECT_ROOT = path.join(__dirname, '..');

const OUTPUT_FILE = cliArgs.outputFile
  ? path.resolve(cliArgs.outputFile)
  : path.join(PROJECT_ROOT, 'data', 'yachtworld_results.jsonl');

const USER_DATA_DIR = path.join(PROJECT_ROOT, '.browser-profile');

// Build URL dynamically from parameters
const conditionSegment = condition === 'any' ? '' : `condition-${condition}/`;
const BASE_URL = `https://www.yachtworld.com/boats-for-sale/${conditionSegment}type-sail/?price=${priceMin}-${priceMax}&length=${lengthMinFt}-${lengthMaxFt}&currency=USD`;

const MIN_PAGE_DELAY_MS = 3000;
const MAX_PAGE_DELAY_MS = 5000;

function randomDelay() {
  return MIN_PAGE_DELAY_MS + Math.random() * (MAX_PAGE_DELAY_MS - MIN_PAGE_DELAY_MS);
}

// Log to both Node.js stdout and the browser DevTools console
async function log(page, msg) {
  console.log(msg);
  await page.evaluate((m) => console.log(`%c[SCRAPER] ${m}`, 'color: #00bfff; font-weight: bold;'), msg).catch(() => {});
}

async function scrollToBottom(page) {
  await page.evaluate(async () => {
    const distance = 400;
    const delay = 250;
    while (
      document.scrollingElement.scrollTop + window.innerHeight <
      document.scrollingElement.scrollHeight
    ) {
      document.scrollingElement.scrollBy(0, distance);
      await new Promise((r) => setTimeout(r, delay));
    }
  });
}

async function extractCards(page, shouldExcludeKetchYawl, shouldExcludeMultihull) {
  return page.evaluate(({ excludeKY, excludeMH }) => {
    const cards = document.querySelectorAll('a[data-ssr-meta]');
    const results = [];

    for (const card of cards) {
      // Skip sponsored listings
      const listingType = card.getAttribute('data-reporting-click-listing-type');
      if (listingType && listingType.toLowerCase().includes('sponsored')) {
        continue;
      }

      // Skip cards inside the extra-sponsored container
      if (card.closest('.extra-sponsored')) {
        continue;
      }

      const listingName =
        card.querySelector('[data-e2e="listingName"]')?.textContent?.trim() || null;

      const ssrMetaRaw = card.getAttribute('data-ssr-meta') || '';

      // Conditionally skip ketches and yawls
      if (excludeKY && (/ketch|yawl/i.test(listingName || '') || /ketch|yawl/i.test(ssrMetaRaw))) {
        continue;
      }

      // Conditionally skip multihulls (class contains "sail-multihull")
      if (excludeMH && /sail-multihull/i.test(ssrMetaRaw)) {
        continue;
      }

      // Split seller content into sellerName and sellerLocation
      const rawSeller = card.querySelector('[data-e2e="listingSellerContent"]')?.textContent?.trim() || null;
      let sellerName = null;
      let sellerLocation = null;
      if (rawSeller && rawSeller.includes('|')) {
        const parts = rawSeller.split('|');
        sellerName = parts[0].trim();
        sellerLocation = parts.slice(1).join('|').trim();
      } else {
        sellerName = rawSeller;
      }

      // Image URL from the listing image
      const imgEl = card.querySelector('[data-e2e="imageWrapper"] img');
      const imgUrl = imgEl?.getAttribute('src') || null;

      // Link URL
      const linkUrl = card.getAttribute('href') || null;

      // Parse data-ssr-meta: Manufacturer|Class|lengthInMeters|State|priceUSD
      const ssrMeta = card.getAttribute('data-ssr-meta') || null;
      let manufacturer = null, boatClass = null, lengthInMeters = null, state = null, priceUSD = null;
      if (ssrMeta) {
        const parts = ssrMeta.split('|');
        manufacturer = parts[0] || null;
        boatClass = parts[1] || null;
        lengthInMeters = parts[2] ? Number(parts[2]) || null : null;
        state = parts[3] || null;
        priceUSD = parts[4] ? Number(parts[4]) || null : null;
      }

      results.push({
        listingName,
        sellerName,
        sellerLocation,
        imgUrl,
        linkUrl: linkUrl ? `https://www.yachtworld.com${linkUrl}` : null,
        manufacturer,
        boatClass,
        lengthInMeters,
        state,
        priceUSD,
      });
    }

    return results;
  }, { excludeKY: shouldExcludeKetchYawl, excludeMH: shouldExcludeMultihull });
}

(async () => {
  console.log(`Scraping URL: ${BASE_URL}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log(`Headless: ${headless}, Exclude ketch/yawl: ${excludeKetchYawl}, Exclude multihull: ${excludeMultihull}`);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clear output file
  fs.writeFileSync(OUTPUT_FILE, '');

  // Use persistent context to retain Cloudflare cookies across navigations
  const browserArgs = ['--disable-blink-features=AutomationControlled'];
  if (!headless) {
    browserArgs.push('--auto-open-devtools-for-tabs');
  }

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: headless,
    viewport: { width: 1440, height: 900 },
    args: browserArgs,
  });

  const page = context.pages()[0] || await context.newPage();

  let pageNum = 1;
  let totalRecords = 0;
  const visitedUrls = new Set();

  try {
    // Navigate to the first page
    await log(page, `[Page ${pageNum}] Navigating to search results...`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Get total results count
    const totalText = await page
      .locator('.results-count')
      .textContent()
      .catch(() => null);
    if (totalText) {
      await log(page, `Total results: ${totalText.trim()}`);
    }

    while (true) {
      // Wait for listing cards to be present in the DOM
      await log(page, `[Page ${pageNum}] Waiting for listings to appear...`);
      await page.waitForSelector('a[data-ssr-meta]', { timeout: 30000 });

      await log(page, `[Page ${pageNum}] Scrolling to load all content...`);
      await scrollToBottom(page);

      // Wait the required delay
      const delay = randomDelay();
      await log(page, `[Page ${pageNum}] Waiting ${(delay / 1000).toFixed(1)}s...`);
      await page.waitForTimeout(delay);

      // Log current URL and detect loops
      const currentUrl = page.url();
      await log(page, `[Page ${pageNum}] Current URL: ${currentUrl}`);

      if (visitedUrls.has(currentUrl)) {
        await log(page, `Detected URL loop (already visited ${currentUrl}). Scraping complete.`);
        break;
      }
      visitedUrls.add(currentUrl);

      // Extract cards
      const cards = await extractCards(page, excludeKetchYawl, excludeMultihull);
      await log(page, `[Page ${pageNum}] Found ${cards.length} non-sponsored listings`);

      // Append each card to the JSONL file
      for (const card of cards) {
        fs.appendFileSync(OUTPUT_FILE, JSON.stringify(card) + '\n');
        totalRecords++;
      }

      await log(page, `[Page ${pageNum}] Total records so far: ${totalRecords}`);

      // Inspect the pagination section to determine navigation
      const paginationState = await page.evaluate(() => {
        const paginationLinks = document.querySelectorAll('.pagination li a');
        const pages = [];
        let activePage = null;
        let lastNumberedPage = null;

        for (const link of paginationLinks) {
          const text = link.textContent.trim();
          const isActive = link.classList.contains('active');
          const isNext = link.classList.contains('next');
          const isPrev = link.classList.contains('prev');

          if (!isNext && !isPrev) {
            const pageNumber = parseInt(text, 10);
            if (!isNaN(pageNumber)) {
              const href = link.getAttribute('href');
              pages.push({ number: pageNumber, active: isActive, href });
              if (pageNumber > (lastNumberedPage || 0)) lastNumberedPage = pageNumber;
              if (isActive) activePage = pageNumber;
            }
          }
        }

        return { pages, activePage, lastNumberedPage };
      });

      await log(page, `[Page ${pageNum}] Pagination: active=${paginationState.activePage}, last=${paginationState.lastNumberedPage}`);
      await log(page, `[Page ${pageNum}] Available pages: ${paginationState.pages.map(p => p.active ? `[${p.number}]` : p.number).join(', ')}`);

      // Stop if we're on the last page (active page is the highest numbered page)
      if (paginationState.activePage === paginationState.lastNumberedPage) {
        await log(page, 'On the last page. Scraping complete.');
        break;
      }

      // Click the next page number in the pagination to navigate
      const nextPageNum = paginationState.activePage + 1;
      pageNum++;

      // Click the pagination link whose text matches the next page number
      const clicked = await page.evaluate((targetNum) => {
        const links = document.querySelectorAll('.pagination li a');
        for (const link of links) {
          if (link.textContent.trim() === String(targetNum)) {
            link.click();
            return true;
          }
        }
        return false;
      }, nextPageNum);

      if (!clicked) {
        await log(page, `Could not find pagination link for page ${nextPageNum}. Scraping complete.`);
        break;
      }

      await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.error(`FATAL ERROR on page ${pageNum}:`, err.message);
    console.error('Stopping. Records scraped so far:', totalRecords);
    process.exitCode = 1;
  } finally {
    await context.close();
    console.log(`\nDone. ${totalRecords} records written to ${OUTPUT_FILE}`);
  }
})();
