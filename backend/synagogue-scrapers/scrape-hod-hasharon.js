'use strict';

/**
 * Hod HaSharon Synagogue Scraper
 * Source: https://mdhh.co.il/רשימת-בתי-כנסת/
 * Destination ID: 366
 *
 * All data is on a single page in HTML tables — no navigation needed.
 * Columns: name, address, gabbai, phone, navigation (skip)
 *
 * Usage:
 *   node scrape-hod-hasharon.js
 *   node scrape-hod-hasharon.js --headed
 *   node scrape-hod-hasharon.js --debug
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DESTINATION_ID = 366;
const CITY           = 'הוד השרון';
const PAGE_URL       = 'https://mdhh.co.il/%D7%A8%D7%A9%D7%99%D7%9E%D7%AA-%D7%91%D7%AA%D7%99-%D7%9B%D7%A0%D7%A1%D7%AA/';
const OUTPUT_FILE    = path.join(__dirname, 'hod_hasharon_synagogues.json');

const HEADED = process.argv.includes('--headed');
const DEBUG  = process.argv.includes('--debug');

function ts()  { return new Date().toLocaleTimeString('he-IL', { hour12: false }); }
const log = (m) => console.log(`[${ts()}] ${m}`);
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  log(`=== Hod HaSharon Synagogue Scraper ===`);

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

  log(`Loading: ${PAGE_URL}`);
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await wait(3000);

  if (DEBUG) {
    fs.writeFileSync(path.join(__dirname, 'hod-hasharon-debug.html'), await page.content(), 'utf-8');
    log('DEBUG: saved hod-hasharon-debug.html');
    await browser.close();
    return;
  }

  // Extract all table rows in Node.js context
  const rawRows = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll('table tr').forEach((tr) => {
      const cells = [...tr.querySelectorAll('td, th')].map(
        (td) => td.innerText?.replace(/\s+/g, ' ').trim() || ''
      );
      if (cells.length >= 2) rows.push(cells);
    });
    return rows;
  });

  await browser.close();

  log(`Raw rows extracted: ${rawRows.length}`);

  // Detect header row by checking if first cell looks like a column label
  const headerKeywords = ['שם', 'כתובת', 'גבאי', 'טלפון', 'ניווט', 'name'];

  const importRows = [];
  const seen = new Set();

  for (const cells of rawRows) {
    // Skip header rows
    const firstCell = cells[0].toLowerCase();
    if (headerKeywords.some(k => firstCell.includes(k))) continue;
    // Skip empty or section-title rows
    if (!cells[0] || cells[0].length < 2) continue;
    if (cells.length === 1) continue;

    const name    = cells[0].trim();
    let   address = (cells[1] || '').trim();
    const gabbai  = (cells[2] || '').trim();
    const phone   = (cells[3] || '').replace(/[^\d\-+,\s]/g, '').trim();

    if (!name || name === address) continue;

    // Append city if not already present
    if (address && !address.includes(CITY)) {
      address = `${address}, ${CITY}`;
    } else if (!address) {
      address = CITY;
    }

    const key = `${name}|${address}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const row = { name, destinationId: DESTINATION_ID, address };
    if (phone)  row.phone = phone;
    if (gabbai) row.description = `גבאי: ${gabbai}`;
    importRows.push(row);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(importRows, null, 2), 'utf-8');
  log(`Done! ${importRows.length} synagogues → ${OUTPUT_FILE}`);
  importRows.forEach((r, i) => log(`  ${i + 1}. ${r.name} | ${r.address}`));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
