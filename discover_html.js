const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const url = 'https://www.yachtworld.com/boats-for-sale/condition-used/type-sail/?price=10000-100000&length=37-42&currency=USD';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Give the page extra time to render dynamic content
  await page.waitForTimeout(5000);

  // Scroll to bottom to trigger lazy loads
  await page.evaluate(async () => {
    for (let i = 0; i < 10; i++) {
      window.scrollBy(0, 500);
      await new Promise(r => setTimeout(r, 300));
    }
  });
  await page.waitForTimeout(3000);

  // Dump the outer HTML of the first few card-like elements
  const cardCandidates = await page.evaluate(() => {
    const results = [];

    // Try various selectors for listing cards
    const selectors = [
      '[data-ssr-meta]',
      '.listing-card',
      '.search-right-col a',
      '.boat-card',
      '[class*="listing"]',
      '[class*="card"]',
      '[class*="boat"]',
      '[class*="search-result"]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results.push({
          selector: sel,
          count: els.length,
          firstOuterHTML: els[0].outerHTML.substring(0, 3000),
          secondOuterHTML: els.length > 1 ? els[1].outerHTML.substring(0, 3000) : null,
        });
      }
    }

    return results;
  });

  console.log('\n=== CARD CANDIDATE SELECTORS ===\n');
  for (const c of cardCandidates) {
    console.log(`Selector: "${c.selector}" — found ${c.count} elements`);
    console.log('First element HTML (truncated):\n', c.firstOuterHTML);
    if (c.secondOuterHTML) {
      console.log('Second element HTML (truncated):\n', c.secondOuterHTML);
    }
    console.log('\n---\n');
  }

  // Also dump the full page HTML structure at a high level
  const bodyStructure = await page.evaluate(() => {
    // Get all elements with "sponsored" or "ad" in class/text
    const sponsoredEls = document.querySelectorAll('[class*="sponsor"], [class*="promoted"], [class*="ad-"], [data-ad]');
    const sponsoredInfo = Array.from(sponsoredEls).map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id,
      outerHTML: el.outerHTML.substring(0, 500),
    }));

    // Get pagination elements
    const paginationEls = document.querySelectorAll('[class*="paginat"], [class*="page"], nav a, .next, [aria-label*="next"], [aria-label*="Next"]');
    const paginationInfo = Array.from(paginationEls).slice(0, 10).map(el => ({
      tag: el.tagName,
      className: el.className,
      href: el.href || null,
      text: el.textContent?.trim().substring(0, 100),
      outerHTML: el.outerHTML.substring(0, 500),
    }));

    return { sponsoredInfo, paginationInfo };
  });

  console.log('\n=== SPONSORED/AD ELEMENTS ===\n');
  console.log(JSON.stringify(bodyStructure.sponsoredInfo, null, 2));

  console.log('\n=== PAGINATION ELEMENTS ===\n');
  console.log(JSON.stringify(bodyStructure.paginationInfo, null, 2));

  // Also get the result count if visible
  const resultCount = await page.evaluate(() => {
    const countEls = document.querySelectorAll('[class*="count"], [class*="result"], [class*="total"]');
    return Array.from(countEls).slice(0, 5).map(el => ({
      className: el.className,
      text: el.textContent?.trim().substring(0, 200),
    }));
  });

  console.log('\n=== RESULT COUNT ELEMENTS ===\n');
  console.log(JSON.stringify(resultCount, null, 2));

  await browser.close();
})();
