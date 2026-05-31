const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEST_ID = 370;
const CITY = 'רמת גן';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  await page.goto('https://mdrg.org.il/beit-kenesset-db-meida/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  function extractRows() {
    return page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr[data-row_id]');
      return Array.from(rows).map(row => {
        const nameCell = row.querySelector('td.ninja_column_0');
        // Remove the toggle span text, keep only the text node
        const nameClone = nameCell?.cloneNode(true);
        nameClone?.querySelector('span')?.remove();
        const name = nameClone?.textContent?.trim() || '';

        const streetName = row.querySelector('.bk_street_name')?.textContent?.trim() || '';
        const streetNum  = row.querySelector('.bk_street_number')?.textContent?.trim() || '';

        const gabbai = row.querySelector('td.ninja_column_3')?.textContent?.trim() || '';
        const phone  = row.querySelector('td.ninja_column_5')?.textContent?.trim() || '';
        const nusach = row.querySelector('td.ninja_column_6')?.textContent?.trim() || '';

        return { name, streetName, streetNum, gabbai, phone, nusach };
      });
    });
  }

  const allRaw = [];

  // Find how many pages exist
  const pageCount = await page.evaluate(() => {
    const items = document.querySelectorAll('ul.pagination li.footable-page[data-page]');
    const nums = Array.from(items).map(li => parseInt(li.getAttribute('data-page'))).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 1;
  });
  console.error(`Found ${pageCount} pages`);

  for (let p = 1; p <= pageCount; p++) {
    if (p > 1) {
      // Click the page number link
      await page.evaluate((pageNum) => {
        const li = document.querySelector(`ul.pagination li.footable-page[data-page="${pageNum}"]`);
        li?.querySelector('a')?.click();
      }, p);
      await page.waitForTimeout(1500);
    }
    const rows = await extractRows();
    console.error(`Page ${p}: ${rows.length} rows`);
    allRaw.push(...rows);
  }

  console.error(`Total raw rows: ${allRaw.length}`);

  // Format and deduplicate
  const seen = new Set();
  const synagogues = [];

  for (const r of allRaw) {
    if (!r.name) continue;
    // Build address: "STREET NAME NUMBER, רמת גן"
    let addr = CITY;
    if (r.streetName) {
      const street = r.streetName.replace(/\s+/g, ' ').trim();
      addr = r.streetNum ? `${street} ${r.streetNum}, ${CITY}` : `${street}, ${CITY}`;
    }

    const key = `${r.name}|${addr}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = { name: r.name, address: addr, destinationId: DEST_ID };
    if (r.nusach)  entry.denomination = r.nusach;
    if (r.phone)   entry.phone = r.phone.replace(/[^\d\-]/g, '').replace(/^(\d{3})(\d+)$/, '$1-$2');
    if (r.gabbai)  entry.description = r.gabbai;
    synagogues.push(entry);
  }

  console.error(`Unique synagogues: ${synagogues.length}`);
  console.error('Sample:', JSON.stringify(synagogues.slice(0, 3), null, 2));

  const outPath = path.join(__dirname, '..', 'import-ramat-gan-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
  console.log(`Saved ${synagogues.length} synagogues`);

  await browser.close();
})();
