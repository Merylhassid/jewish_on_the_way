'use strict';

/**
 * Haifa Synagogue Scraper
 * Source: https://www.mdhaifa.org/בתי-כנסת
 * Destination ID: 395
 *
 * Two-phase:
 *   1. Collect neighborhood links from main page
 *   2. Scrape each neighborhood page for synagogue entries
 *
 * Usage:
 *   node scrape-haifa.js            → headless
 *   node scrape-haifa.js --headed   → visible browser
 *   node scrape-haifa.js --debug    → dump main page HTML and exit
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DESTINATION_ID = 395;
const CITY           = 'חיפה';
const MAIN_URL       = 'https://www.mdhaifa.org/בתי-כנסת';
const BASE_URL       = 'https://www.mdhaifa.org';
const OUTPUT_FILE    = path.join(__dirname, 'haifa_synagogues.json');
const PROGRESS_FILE  = path.join(__dirname, 'haifa_progress.json');

const HEADED = process.argv.includes('--headed');
const DEBUG  = process.argv.includes('--debug');

function ts()  { return new Date().toLocaleTimeString('he-IL', { hour12: false }); }
const log    = (m) => console.log(`[${ts()}] ${m}`);
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { results: [], doneUrls: new Set() };
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    const results = data.results || [];
    log(`Resumed: ${results.length} synagogues already scraped from ${new Set(results.map(r => r._neighborhood)).size} neighborhoods`);
    return { results, doneUrls: new Set(data.doneUrls || []) };
  } catch { return { results: [], doneUrls: new Set() }; }
}

function saveProgress(results, doneUrls) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ results, doneUrls: [...doneUrls] }, null, 2), 'utf-8');
}

// ─── Phase 1: collect neighborhood links ─────────────────────────────────────

async function collectNeighborhoodLinks(page) {
  log(`Loading main page: ${MAIN_URL}`);
  await page.goto(MAIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await wait(5000); // Wix JS render

  if (DEBUG) {
    fs.writeFileSync(path.join(__dirname, 'haifa-debug.html'), await page.content(), 'utf-8');
    log('DEBUG: saved haifa-debug.html');
    return [];
  }

  const links = await page.evaluate((baseUrl) => {
    const seen = new Set();
    const results = [];

    // Exclude nav/header/footer
    const excluded = new Set(
      [...document.querySelectorAll('header, nav, footer, [role="navigation"], [id*="nav"], [class*="nav"], [class*="header"], [class*="footer"], [class*="menu"]')]
        .flatMap((el) => [el, ...el.querySelectorAll('*')])
    );

    document.querySelectorAll('a[href]').forEach((a) => {
      if (excluded.has(a)) return;
      const href = a.href;
      if (!href || !href.startsWith(baseUrl)) return;
      try {
        const u = new URL(href);
        const p = decodeURIComponent(u.pathname);
        // Must match neighborhood pattern: /בתי-כנסת-SOMETHING
        if (!p.includes('בתי-כנסת-') || p === '/בתי-כנסת' || p === '/בתי-כנסת/') return;
        if (seen.has(href)) return;
        seen.add(href);
        const name = a.innerText?.trim() || p.split('/').pop();
        results.push({ url: href, name });
      } catch { /* skip */ }
    });

    return results;
  }, BASE_URL);

  log(`Found ${links.length} neighborhood links`);
  return links;
}

// ─── Phase 2: scrape synagogues from one neighborhood page ───────────────────

async function scrapeNeighborhood(page, url, neighborhoodName) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await wait(4000);

    // Get text in Node.js to avoid Hebrew serialization issues in page.evaluate
    const fullText = await page.evaluate(() => document.body.innerText || '');

    const results = [];
    const entryRegex = /שם בית הכנסת[:\s]+([^\n\r]+)/g;
    let match;

    while ((match = entryRegex.exec(fullText)) !== null) {
      const name = match[1].trim();
      if (!name || name.length < 2) continue;

      const snippet = fullText.slice(match.index, match.index + 300);
      const addrMatch = snippet.match(/(?:כתובת|תפקיד)[:\s]+([^\n\r]+)/);
      if (!addrMatch) continue;

      let address = addrMatch[1]
        .replace(/חיפה\s*[א-ת]'?\s*$/i, '')
        .replace(/,?\s*חיפה\s*$/i, '')
        .trim();

      if (!address) continue;

      results.push({
        name,
        address: `${address}, ${CITY}`,
        _neighborhood: neighborhoodName,
      });
    }

    log(`  ${neighborhoodName}: ${results.length} synagogues`);
    return results;
  } catch (err) {
    log(`  ERROR on ${neighborhoodName}: ${err.message}`);
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`=== Haifa Synagogue Scraper ===`);

  const { results, doneUrls } = loadProgress();

  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8' },
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const neighborhoods = await collectNeighborhoodLinks(page);
  if (DEBUG) { await browser.close(); return; }

  const toScrape = neighborhoods.filter(n => !doneUrls.has(n.url));
  log(`To scrape: ${toScrape.length} neighborhoods (${doneUrls.size} already done)`);

  for (const { url, name } of toScrape) {
    log(`\nScraping: ${name}`);
    const entries = await scrapeNeighborhood(page, url, name);
    results.push(...entries);
    doneUrls.add(url);
    saveProgress(results, doneUrls);
    await wait(2000 + Math.random() * 2000);
  }

  await browser.close();

  // Build import rows — deduplicate
  const seen = new Set();
  const importRows = results
    .filter(r => {
      const key = `${r.name}|${r.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(r => {
      const row = { name: r.name, destinationId: DESTINATION_ID };
      if (r.address) row.address = r.address;
      return row;
    });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(importRows, null, 2), 'utf-8');
  log(`\nDone! ${importRows.length} synagogues → ${OUTPUT_FILE}`);
  importRows.forEach((r, i) => log(`  ${i + 1}. ${r.name} | ${r.address || '(no addr)'}`));
}

process.on('SIGINT', () => { log('Interrupted — progress saved.'); process.exit(0); });
main().catch(err => { console.error('Fatal:', err); process.exit(1); });
