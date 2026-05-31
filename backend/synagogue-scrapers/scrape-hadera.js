'use strict';

/**
 * Hadera Synagogue Scraper
 * Source: https://haderamd.org.il/directory-synagogues/
 * Destination ID: 311
 *
 * The site uses SabaiDIRECTORY (DRTS). Adding ?num=200 loads all listings
 * on a single page — no pagination needed.
 *
 * Usage:
 *   node scrape-hadera.js            → headless
 *   node scrape-hadera.js --headed   → visible browser
 *   node scrape-hadera.js --debug    → dump HTML and exit
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DESTINATION_ID = 311;
const CITY           = 'חדרה';
const LIST_URL       = 'https://haderamd.org.il/directory-synagogues/?num=200&sort=post_published';
const OUTPUT_FILE    = path.join(__dirname, 'hadera_synagogues.json');

const HEADED = process.argv.includes('--headed');
const DEBUG  = process.argv.includes('--debug');

function ts()  { return new Date().toLocaleTimeString('he-IL', { hour12: false }); }
const log    = (m) => console.log(`[${ts()}] ${m}`);

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  log(`=== Hadera Synagogue Scraper ===`);
  log(`Loading: ${LIST_URL}`);

  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    viewport: { width: 1366, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8' },
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await wait(4000); // let DRTS JS render

  if (DEBUG) {
    fs.writeFileSync(path.join(__dirname, 'hadera-debug.html'), await page.content(), 'utf-8');
    log('DEBUG: HTML saved to hadera-debug.html');
    await browser.close();
    return;
  }

  const results = await page.evaluate((city) => {
    const cards = [];

    // Each card is wrapped in div.drts-view-entity-container
    document.querySelectorAll('div.drts-view-entity-container').forEach((card) => {
      // Name
      const nameEl = card.querySelector('a.drts-entity-permalink');
      const name = nameEl?.textContent?.trim();
      if (!name || name.length < 2) return;

      // Address with city: class contains "entity_field_location_address-2"
      const addrEl = card.querySelector(
        '.drts-display-element-entity_field_location_address-2 .drts-location-address'
      );
      let address = addrEl?.textContent?.trim() || null;

      if (address) {
        // Normalise: strip trailing city name then re-add with comma
        address = address.replace(/[,،]\s*חדרה\s*$/i, '').replace(/\s+חדרה\s*$/i, '').trim();
        address = `${address}, ${city}`;
      }

      // Phone: gabbai phone link
      const phoneEl = card.querySelector('[data-name="entity_field_field_gabphone"] a[href^="tel:"]');
      const phone = phoneEl?.getAttribute('data-phone-number') || null;

      cards.push({ name, address, phone });
    });

    return cards;
  }, CITY);

  await browser.close();

  log(`Found ${results.length} synagogues`);

  // Deduplicate by name+address
  const seen = new Set();
  const deduped = results.filter((r) => {
    const key = `${r.name}|${r.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build import format
  const importRows = deduped.map((r) => {
    const row = { name: r.name, destinationId: DESTINATION_ID };
    if (r.address) row.address = r.address;
    if (r.phone)   row.phone   = r.phone;
    return row;
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(importRows, null, 2), 'utf-8');
  log(`Done! ${importRows.length} synagogues → ${OUTPUT_FILE}`);
  importRows.forEach((r, i) => log(`  ${i + 1}. ${r.name} | ${r.address || '(no addr)'}`));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
