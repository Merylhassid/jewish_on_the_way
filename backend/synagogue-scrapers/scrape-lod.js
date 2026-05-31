const { chromium } = require('playwright');

const BASE_URL = 'https://mdlod.org.il/directory-synagogues/';
const PAGES = [1, 2];
const DEST_ID = 289;

async function scrapePage(page, pageNum) {
  const url = `${BASE_URL}?_page=${pageNum}&num=100&sort=post_published`;
  console.log(`Fetching page ${pageNum}: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const results = await page.evaluate(() => {
    const containers = document.querySelectorAll('div.drts-view-entity-container');
    const items = [];

    containers.forEach(card => {
      // Name
      const nameEl = card.querySelector('a.drts-entity-permalink');
      const name = nameEl ? nameEl.textContent.trim() : null;
      if (!name) return;

      // Address — try several selectors
      let address = null;
      const addrEl =
        card.querySelector('.drts-location-address') ||
        card.querySelector('[class*="location_address"] [class*="address"]') ||
        card.querySelector('[class*="field_address"]');
      if (addrEl) address = addrEl.textContent.trim();

      // Denomination (נוסח)
      let denomination = null;
      const allText = card.innerText || '';
      const nusachMatch = allText.match(/נוסח[:\s]+([^\n]+)/);
      if (nusachMatch) denomination = nusachMatch[1].trim();

      // Phone
      let phone = null;
      const phoneEl = card.querySelector('a[href^="tel:"]');
      if (phoneEl) phone = phoneEl.textContent.trim();

      items.push({ name, address, denomination, phone });
    });

    return items;
  });

  console.log(`  Page ${pageNum}: found ${results.length} entries`);
  return results;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  const all = [];
  for (const p of PAGES) {
    const items = await scrapePage(page, p);
    all.push(...items);
  }

  await browser.close();

  // Add city suffix and build import format
  const output = all
    .filter(s => s.name)
    .map(s => {
      let address = s.address || '';
      if (address && !address.includes('לוד')) address = `${address}, לוד`;
      if (!address) address = 'לוד';
      const entry = { name: s.name, address, destinationId: DEST_ID };
      if (s.denomination) entry.denomination = s.denomination;
      if (s.phone) entry.phone = s.phone;
      return entry;
    });

  console.log(`\nTotal: ${output.length} synagogues`);
  output.forEach(s => console.log(`  ${s.name} | ${s.address} | ${s.denomination || ''}`));

  const fs = require('fs');
  fs.writeFileSync(
    require('path').join(__dirname, '..', 'import-lod-synagogues.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );
  console.log('\nSaved to import-lod-synagogues.json');
})();
