const { chromium } = require('playwright');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DEST_ID = 421;
const CITY = 'טבריה';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  // Step 1: get all synagogue links from REST API
  console.error('Fetching all synagogue links from REST API...');
  const items = await fetchJson('https://mdt.org.il/wp-json/wp/v2/synagogues?per_page=100&page=1&_fields=id,title,link');
  console.error(`Got ${items.length} synagogues from API`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const synagogues = [];
  const seen = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = item.link;
    const apiName = item.title?.rendered || '';

    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(600);

      const data = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        const extract = (patterns) => {
          for (const pat of patterns) {
            const m = bodyText.match(pat);
            if (m && m[1]) return m[1].trim();
          }
          return '';
        };

        const name = (document.querySelector('h1')?.innerText || '').trim();

        const gabbai = extract([
          /גבאי בית הכנסת:\s*([^\n]+)/,
          /שם גבאי:\s*([^\n]+)/,
          /גבאי:\s*([^\n]+)/,
        ]);

        const phone = extract([
          /טלפון:\s*(0[0-9\-]+)/,
          /נייד:\s*(0[0-9\-]+)/,
          /פלאפון:\s*(0[0-9\-]+)/,
        ]);

        const address = extract([
          /כתובת:\s*([^\n]+)/,
          /רחוב:\s*([^\n]+)/,
        ]);

        const neighborhood = extract([
          /שכונה:\s*([^\n]+)/,
        ]);

        const denomination = extract([
          /נוסח:\s*([^\n]+)/,
          /עדה:\s*([^\n]+)/,
        ]);

        return { name, gabbai, phone, address, neighborhood, denomination };
      });

      await page.close();

      const name = data.name || apiName;
      if (!name) { console.error(`  [${i+1}] No name, skipping`); continue; }

      let address = data.address || '';
      if (address && !address.includes(CITY)) address += `, ${CITY}`;
      if (!address) address = CITY;

      const key = `${name}|${address}`;
      if (seen.has(key)) { console.error(`  [${i+1}] Duplicate: "${name}"`); continue; }
      seen.add(key);

      const entry = { name, address, destinationId: DEST_ID };
      if (data.denomination) entry.denomination = data.denomination;
      if (data.phone) entry.phone = data.phone;

      const descParts = [];
      if (data.gabbai) descParts.push(`שם גבאי - ${data.gabbai}`);
      if (data.neighborhood) descParts.push(`שכונה - ${data.neighborhood}`);
      if (descParts.length) entry.description = descParts.join('\n');

      synagogues.push(entry);
      console.error(`  [${i+1}/${items.length}] "${name}" | ${address}`);

    } catch (err) {
      console.error(`  [${i+1}] Error on ${url}: ${err.message}`);
    }

    // Polite delay
    await new Promise(r => setTimeout(r, 400));
  }

  await browser.close();

  console.error(`\nTotal: ${synagogues.length} synagogues`);
  const outPath = path.join(__dirname, '..', 'import-tiberias-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
  console.log(`Saved ${synagogues.length} synagogues to ${outPath}`);
})();
