const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DESTINATION_ID = parseInt(process.argv[2] || '0');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  await page.goto('https://www.oryehudat.co.il/%D7%91%D7%AA%D7%99-%D7%9B%D7%A0%D7%A1%D7%AA/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const synagogues = await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll('table tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;
      const name = cells[0]?.textContent.trim();
      const address = cells[1]?.textContent.trim();
      const gabbaiFull = cells[2]?.textContent.trim() || '';
      if (!name || name === 'שם בית הכנסת') continue;

      // Extract phone: find Israeli phone pattern
      const phoneMatch = gabbaiFull.match(/0\d[\d\-]{7,10}/);
      const phone = phoneMatch ? phoneMatch[0].replace(/-/g, '-') : '';

      results.push({ name, address, phone });
    }
    return results;
  });

  console.error(`Extracted ${synagogues.length} synagogues`);
  if (synagogues.length > 0) console.error('Sample:', JSON.stringify(synagogues.slice(0, 3)));

  const output = synagogues.map(s => {
    let addr = s.address.replace(/,?\s*Israel$/i, '').replace(/,?\s*ישראל$/i, '').trim();
    if (!addr.includes('אור יהודה')) addr = addr ? `${addr}, אור יהודה` : 'אור יהודה';
    const entry = { name: s.name, address: addr, destinationId: DESTINATION_ID };
    if (s.phone) entry.phone = s.phone;
    return entry;
  });

  const outPath = path.join(__dirname, '..', 'import-or-yehuda-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Saved ${output.length} synagogues`);

  await browser.close();
})();
