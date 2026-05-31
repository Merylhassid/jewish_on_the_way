const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEST_ID = 367;
const BASE_URL = 'https://mdrl.org.il/%D7%91%D7%AA%D7%99-%D7%9B%D7%A0%D7%A1%D7%AA/';
const TOTAL_PAGES = 7;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  const allRaw = [];

  for (let p = 1; p <= TOTAL_PAGES; p++) {
    const url = p === 1 ? BASE_URL : `${BASE_URL}?lfi-page=${p}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    const rows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.lfi-row.lfi-body-row')).map(row => {
        const cols = row.querySelectorAll('div.lfi-body-col');
        return {
          name:         cols[0]?.textContent?.trim() || '',
          denomination: cols[1]?.textContent?.trim() || '',
          neighborhood: cols[2]?.textContent?.trim() || '',
          address:      cols[3]?.textContent?.trim() || '',
        };
      });
    });

    console.error(`Page ${p}: ${rows.length} rows`);
    allRaw.push(...rows);
  }

  console.error(`Total raw: ${allRaw.length}`);

  const seen = new Set();
  const synagogues = [];

  for (const r of allRaw) {
    if (!r.name) continue;

    // Normalize address: replace "ראשל"צ" with "ראשון לציון"
    let address = r.address
      .replace(/ראשל["״]צ/g, 'ראשון לציון')
      .replace(/\s+/g, ' ')
      .trim();
    if (!address) address = 'ראשון לציון';
    if (!address.includes('ראשון לציון')) address += ', ראשון לציון';

    const key = `${r.name}|${address}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = { name: r.name, address, destinationId: DEST_ID };
    if (r.denomination) entry.denomination = r.denomination;
    if (r.neighborhood) entry.description = `שכונה - ${r.neighborhood}`;
    synagogues.push(entry);
  }

  console.error(`Unique synagogues: ${synagogues.length}`);
  console.error('Sample:', JSON.stringify(synagogues.slice(0, 3), null, 2));

  const outPath = path.join(__dirname, '..', 'import-rishon-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
  console.log(`Saved ${synagogues.length} synagogues`);

  await browser.close();
})();
