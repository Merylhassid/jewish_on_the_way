const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEST_ID = 312;
const CITY = 'רחובות';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  await page.goto('https://dat-rehovot.co.il/shuls-list/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  function extractRows() {
    return page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr[data-row_id]');
      return Array.from(rows).map(row => {
        const t = (sel) => row.querySelector(sel)?.textContent?.trim() || '';
        return {
          name:        t('td.ninja_column_0'),
          nusach:      t('td.ninja_column_1'),
          address:     t('td.ninja_column_2'),
          gabbaiName:  t('td.ninja_column_3'),
          phone:       t('td.ninja_column_4'),
          // col 5 = gabbai address — skip
          email:       t('td.ninja_column_6'),
          rabbi:       t('td.ninja_column_7'),
        };
      });
    });
  }

  const pageCount = await page.evaluate(() => {
    const items = document.querySelectorAll('ul.pagination li.footable-page[data-page]');
    const nums = Array.from(items).map(li => parseInt(li.getAttribute('data-page'))).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 1;
  });
  console.error(`Found ${pageCount} pages`);

  const allRaw = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p > 1) {
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

  console.error(`Total raw: ${allRaw.length}`);

  function normalizeAddress(raw) {
    // Format: "הגליל 18 רחובות" → "הגליל 18, רחובות"
    // Some may already have comma or just be street+city
    let addr = raw.replace(/\s+/g, ' ').trim();
    if (!addr || addr === CITY) return CITY;
    // If ends with "רחובות" without comma before it, add comma
    addr = addr.replace(/\s+רחובות$/i, `, ${CITY}`);
    // If doesn't contain city at all, append
    if (!addr.includes(CITY)) addr = `${addr}, ${CITY}`;
    return addr;
  }

  function buildDescription(r) {
    const parts = [];
    if (r.gabbaiName) parts.push(`שם גבאי - ${r.gabbaiName}`);
    if (r.email)      parts.push(`אימייל גבאי - ${r.email}`);
    if (r.rabbi)      parts.push(`פרטי רב בית הכנסת - ${r.rabbi}`);
    return parts.join('\n');
  }

  const seen = new Set();
  const synagogues = [];

  for (const r of allRaw) {
    if (!r.name) continue;
    const address = normalizeAddress(r.address);
    const key = `${r.name}|${address}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = { name: r.name, address, destinationId: DEST_ID };
    if (r.nusach) entry.denomination = r.nusach;
    const phone = r.phone.replace(/[\s‏‎]/g, '').trim();
    if (phone) entry.phone = phone;
    const desc = buildDescription(r);
    if (desc) entry.description = desc;
    synagogues.push(entry);
  }

  console.error(`Unique synagogues: ${synagogues.length}`);
  console.error('Sample:', JSON.stringify(synagogues.slice(0, 2), null, 2));

  const outPath = path.join(__dirname, '..', 'import-rehovot-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
  console.log(`Saved ${synagogues.length} synagogues`);

  await browser.close();
})();
