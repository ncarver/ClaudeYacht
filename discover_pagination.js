const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const url = 'https://www.yachtworld.com/boats-for-sale/condition-used/type-sail/?price=10000-100000&length=37-42&currency=USD';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Scroll all the way to the bottom
  await page.evaluate(async () => {
    const distance = 500;
    const delay = 300;
    while (document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight) {
      document.scrollingElement.scrollBy(0, distance);
      await new Promise(r => setTimeout(r, delay));
    }
  });
  await page.waitForTimeout(3000);

  // Look specifically for pagination
  const paginationInfo = await page.evaluate(() => {
    const results = {};

    // Check for next/prev buttons or links
    const nextSelectors = [
      'a[class*="next"]', 'button[class*="next"]',
      '[aria-label="Next"]', '[aria-label="Next page"]',
      '.pagination a', '.pagination button',
      '[class*="pagination"]',
      'a[rel="next"]',
      '.paging a', '.pager a',
    ];
    for (const sel of nextSelectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results[sel] = Array.from(els).map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 100),
          href: el.href || null,
          className: el.className,
          outerHTML: el.outerHTML.substring(0, 500),
        }));
      }
    }

    // Also look at the very bottom of the page for any page numbers
    const bottomHTML = document.querySelector('.search-right-col')?.innerHTML?.slice(-3000) || 'search-right-col not found';
    results['bottomOfSearchCol'] = bottomHTML.substring(0, 2000);

    // Total results text
    const headerEls = document.querySelectorAll('.inner-content-header, .search-header, .results-header, [class*="result"]');
    results['headerElements'] = Array.from(headerEls).slice(0, 5).map(el => ({
      className: el.className,
      text: el.textContent?.trim().substring(0, 200),
    }));

    return results;
  });

  console.log(JSON.stringify(paginationInfo, null, 2));
  await browser.close();
})();
