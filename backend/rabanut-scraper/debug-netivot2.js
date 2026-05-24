const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });
  await page.goto('https://www.mdnetivot.org/synagogues-3', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Get all rich-text elements and horizontal lines in DOM order
  const elements = await page.evaluate(() => {
    const all = document.querySelectorAll('[data-testid="richTextElement"], .wixui-horizontal-line, [class*="horizontal-line"]');
    const items = [];
    for (const el of all) {
      if (el.classList.contains('wixui-horizontal-line') || el.className.includes('horizontal-line')) {
        items.push({ type: 'HR' });
      } else {
        const text = el.textContent.trim();
        const links = Array.from(el.querySelectorAll('a[href^="tel:"]')).map(a => a.getAttribute('href').replace('tel:', ''));
        const isBold = !!el.querySelector('[style*="font-weight:bold"], b, strong');
        if (text) items.push({ type: 'TEXT', text, links, isBold });
      }
    }
    return items;
  });

  fs.writeFileSync(path.join(__dirname, 'netivot-elements.json'), JSON.stringify(elements, null, 2), 'utf8');
  console.log(`Total elements: ${elements.length}`);
  console.log('First 40:');
  elements.slice(0, 40).forEach((e, i) => console.log(i, JSON.stringify(e)));
  await browser.close();
})();
