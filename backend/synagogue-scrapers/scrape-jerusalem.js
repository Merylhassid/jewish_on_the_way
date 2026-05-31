'use strict';

/**
 * Jerusalem Synagogue Scraper — kipa.co.il
 * Source: https://www.kipa.co.il/בתי-כנסת/ירושלים/
 * Destination ID: 331
 * 26 pages, 3 columns per row: name, nusach, address
 *
 * Usage:
 *   node scrape-jerusalem.js            → headless
 *   node scrape-jerusalem.js --headed   → visible browser
 *   node scrape-jerusalem.js --debug    → dump page 1 HTML and exit
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DESTINATION_ID = 331;
const CITY           = 'ירושלים';
const BASE_URL       = 'https://www.kipa.co.il/בתי-כנסת/ירושלים/';
const TOTAL_PAGES    = 26;
const OUTPUT_FILE    = path.join(__dirname, 'jerusalem_synagogues.json');
const PROGRESS_FILE  = path.join(__dirname, 'jerusalem_progress.json');

const HEADED = process.argv.includes('--headed');
const DEBUG  = process.argv.includes('--debug');

function ts()  { return new Date().toLocaleTimeString('he-IL', { hour12: false }); }
const log = (m) => console.log(`[${ts()}] ${m}`);
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function pageUrl(n) {
  return n === 1 ? BASE_URL : `${BASE_URL}page/${n}/`;
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { results: [], donePage: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    log(`Resumed: ${data.results.length} synagogues, last page: ${data.donePage}`);
    return data;
  } catch { return { results: [], donePage: 0 }; }
}

function saveProgress(results, donePage) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ results, donePage }, null, 2), 'utf-8');
}

async function scrapePage(page, pageNum) {
  const url = pageUrl(pageNum);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await wait(2000);

  if (DEBUG && pageNum === 1) {
    fs.writeFileSync(path.join(__dirname, 'jerusalem-debug.html'), await page.content(), 'utf-8');
    log('DEBUG: saved jerusalem-debug.html');
    return null;
  }

  const rows = await page.evaluate(() => {
    const results = [];
    // Try table rows first
    document.querySelectorAll('table tr').forEach((tr) => {
      const cells = [...tr.querySelectorAll('td')].map(
        td => td.innerText?.replace(/\s+/g, ' ').trim() || ''
      );
      if (cells.length >= 2) results.push(cells);
    });

    // Fallback: list items with structured content
    if (results.length === 0) {
      document.querySelectorAll('li, .item, .row, [class*="shul"], [class*="synagogue"]').forEach((el) => {
        const text = el.innerText?.replace(/\s+/g, ' ').trim();
        if (text && text.length > 5) results.push([text]);
      });
    }

    return results;
  });

  return rows;
}

async function main() {
  log(`=== Jerusalem Synagogue Scraper ===`);

  const { results, donePage } = loadProgress();

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

  // Debug mode — just dump page 1
  if (DEBUG) {
    await scrapePage(page, 1);
    await browser.close();
    return;
  }

  const startPage = donePage + 1;
  log(`Starting from page ${startPage} / ${TOTAL_PAGES}`);

  for (let p = startPage; p <= TOTAL_PAGES; p++) {
    log(`Page ${p}/${TOTAL_PAGES} — ${pageUrl(p)}`);
    try {
      const rows = await scrapePage(page, p);
      if (!rows) break;
      log(`  → ${rows.length} raw rows`);
      results.push(...rows.map(r => ({ _page: p, cells: r })));
      saveProgress(results, p);
    } catch (err) {
      log(`  ERROR on page ${p}: ${err.message}`);
    }
    await wait(1500 + Math.random() * 1000);
  }

  await browser.close();

  // Parse rows into import format
  const headerKeywords = ['שם', 'נוסח', 'כתובת', 'name', 'address'];
  const seen = new Set();
  const importRows = [];

  for (const { cells } of results) {
    if (!cells || cells.length < 2) continue;
    const first = cells[0].toLowerCase();
    if (headerKeywords.some(k => first.includes(k))) continue;

    const name    = cells[0]?.trim();
    const nusach  = cells.length >= 3 ? cells[1]?.trim() : '';
    const address = cells.length >= 3 ? cells[2]?.trim() : cells[1]?.trim();

    if (!name || name.length < 2) continue;

    let cleanAddress = (address || '').replace(/,?\s*ירושלים\s*$/i, '').trim();
    if (cleanAddress) cleanAddress = `${cleanAddress}, ${CITY}`;
    else cleanAddress = CITY;

    const key = `${name}|${cleanAddress}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const row = { name, destinationId: DESTINATION_ID, address: cleanAddress };
    if (nusach) row.description = `נוסח: ${nusach}`;
    importRows.push(row);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(importRows, null, 2), 'utf-8');
  log(`\nDone! ${importRows.length} synagogues → ${OUTPUT_FILE}`);
  importRows.slice(0, 10).forEach((r, i) => log(`  ${i + 1}. ${r.name} | ${r.address} | ${r.description || ''}`));
}

process.on('SIGINT', () => { log('Interrupted — progress saved.'); process.exit(0); });
main().catch(err => { console.error('Fatal:', err); process.exit(1); });
