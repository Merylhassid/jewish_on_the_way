const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  console.error('Loading page...');
  await page.goto('https://mdn.org.il/directory-synagogues/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Debug: count items
  const count = await page.locator('div.drts-view-entity-container').count();
  console.error(`Found ${count} entity containers`);

  if (count === 0) {
    // Try to find alternative selectors
    const html = await page.content();
    const matches = html.match(/class="[^"]*drts[^"]*"/gi) || [];
    console.error('DRTS classes:', [...new Set(matches)].slice(0, 20).join('\n'));
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    console.error('Body:', bodyText);
    await browser.close();
    return;
  }

  const synagogues = await page.evaluate(() => {
    const items = document.querySelectorAll('div.drts-view-entity-container');
    const results = [];

    for (const item of items) {
      // Name
      const nameEl = item.querySelector('a.drts-entity-permalink, h3 a, .drts-display-element-title a, [class*="title"] a');
      const name = nameEl ? nameEl.textContent.trim() : '';

      // Address
      const addrEl = item.querySelector('.drts-location-address, [class*="address"], [class*="location"]');
      const address = addrEl ? addrEl.textContent.trim() : '';

      // Phone
      const phoneEl = item.querySelector('[class*="phone"], [href^="tel:"]');
      const phone = phoneEl
        ? (phoneEl.getAttribute('href') || phoneEl.textContent).replace('tel:', '').trim()
        : '';

      // Denomination / נוסח
      const denomEl = item.querySelector('[class*="nusach"], [class*="denom"], [class*="type"]');
      const denomination = denomEl ? denomEl.textContent.trim() : '';

      if (name) results.push({ name, address, phone, denomination });
    }
    return results;
  });

  console.error(`Extracted ${synagogues.length} synagogues`);
  if (synagogues.length > 0) {
    console.error('Sample:', JSON.stringify(synagogues[0]));
  }

  // Add destinationId and city suffix
  const output = synagogues.map(s => {
    const addr = s.address && !s.address.includes('נתניה')
      ? `${s.address}, נתניה`
      : (s.address || 'נתניה');
    const entry = { name: s.name, address: addr, destinationId: 358 };
    if (s.denomination) entry.denomination = s.denomination;
    if (s.phone) entry.phone = s.phone;
    return entry;
  });

  const outPath = path.join(__dirname, '..', 'import-netanya-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Saved ${output.length} synagogues to ${outPath}`);

  await browser.close();
})();
