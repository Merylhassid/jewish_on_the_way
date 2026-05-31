'use strict';

/**
 * Gedera Synagogue Scraper
 * Source: https://www.gederamd.org/synagogues
 * Destination ID: 310
 *
 * Usage:
 *   node scrape-gedera.js            → headless
 *   node scrape-gedera.js --headed   → visible browser
 *   node scrape-gedera.js --debug    → dump first page HTML and exit
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DESTINATION_ID  = 310;
const CITY            = 'גדרה';
const LIST_URL        = 'https://www.gederamd.org/synagogues';
const BASE_URL        = 'https://www.gederamd.org';
const OUTPUT_FILE     = path.join(__dirname, 'gedera_synagogues.json');
const PROGRESS_FILE   = path.join(__dirname, 'gedera_progress.json');

const DETAIL_DELAY_MIN = 3;
const DETAIL_DELAY_MAX = 8;

const HEADED = process.argv.includes('--headed');
const DEBUG  = process.argv.includes('--debug');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts() { return new Date().toLocaleTimeString('he-IL', { hour12: false }); }
const log    = (m) => console.log(`[${ts()}] ${m}`);
const logErr = (m) => console.error(`[${ts()}] ✗  ${m}`);

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function humanDelay(minSec, maxSec) {
  const sec = +(Math.random() * (maxSec - minSec) + minSec).toFixed(1);
  log(`  ⏱  Waiting ${sec}s…`);
  await wait(sec * 1000);
}

async function humanScroll(page) {
  try {
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight * 0.4, behavior: 'smooth' });
    });
    await wait(600 + Math.random() * 600);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await wait(300);
  } catch { /* non-fatal */ }
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { results: [], doneUrls: new Set() };
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    const results = data.results || [];
    log(`Resumed: ${results.length} already scraped`);
    return { results, doneUrls: new Set(results.map((r) => r._sourceUrl).filter(Boolean)) };
  } catch { return { results: [], doneUrls: new Set() }; }
}

function saveProgress(results) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ results }, null, 2), 'utf-8');
}

// ─── Convert raw scraped item → import format ─────────────────────────────────

function toImportRow(raw) {
  const addr = raw.address
    ? (raw.address.includes(CITY) ? raw.address : `${raw.address}, ${CITY}`)
    : null;

  // Build description from extra fields
  const extras = [];
  if (raw.nusach)       extras.push(`נוסח: ${raw.nusach}`);
  if (raw.rabbi)        extras.push(`רב: ${raw.rabbi}`);
  if (raw.gabbai)       extras.push(`גבאי: ${raw.gabbai}`);
  if (raw.hours)        extras.push(`זמני תפילה: ${raw.hours}`);
  if (raw.neighborhood) extras.push(`שכונה: ${raw.neighborhood}`);
  if (raw.notes)        extras.push(raw.notes);

  // Any leftover raw_fields not already mapped
  if (raw.raw_fields) {
    const mapped = new Set(['שם', 'שם בית הכנסת', 'כתובת', 'רחוב', 'עיר', 'יישוב',
      'טלפון', 'פלאפון', 'נייד', 'נוסח', 'נוסח תפילה', 'מנהג',
      'רב', 'רב הקהילה', 'גבאי', 'שמש', 'זמנים', 'שעות',
      'שכונה', 'הערות', 'מידע נוסף', 'תיאור', 'אתר', 'קישור']);
    for (const [k, v] of Object.entries(raw.raw_fields)) {
      if (!mapped.has(k) && v) extras.push(`${k}: ${v}`);
    }
  }

  const row = {
    name:          raw.name || '(ללא שם)',
    destinationId: DESTINATION_ID,
  };
  if (addr)           row.address     = addr;
  if (raw.phone)      row.phone       = raw.phone;
  if (raw.website)    row.website     = raw.website;
  if (extras.length)  row.description = extras.join(' | ');

  return row;
}

// ─── Phase 1: collect synagogue links from list page ─────────────────────────

async function collectLinks(page) {
  log(`Loading list page: ${LIST_URL}`);
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await wait(4000); // let Wix JS render
  await humanScroll(page);

  if (DEBUG) {
    fs.writeFileSync(path.join(__dirname, 'gedera-debug.html'), await page.content(), 'utf-8');
    log('DEBUG: HTML saved to gedera-debug.html');
    return [];
  }

  // Wait for Wix content to render
  await wait(3000);

  const links = await page.evaluate((baseUrl) => {
    const seen = new Set();
    const results = [];

    // Exclude nav / header / footer elements
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
        const p = u.pathname;
        // Must be a sub-page (not root or the list page itself)
        if (!p || p === '/' || p === '/synagogues' || p === '/synagogues/') return;
        // Skip known non-synagogue pages
        const topLevel = p.split('/').filter(Boolean)[0] || '';
        const skip = ['about','contact','home','privacy','terms','blog','news','gallery',
          'events','kashrus','burial','mikveh','wedding','cemetery','shabbat'];
        if (skip.some((s) => topLevel.toLowerCase().includes(s))) return;
        if (seen.has(href)) return;
        seen.add(href);
        results.push({ url: href, text: a.innerText.trim() });
      } catch { /* skip */ }
    });
    return results;
  }, BASE_URL);

  log(`Found ${links.length} candidate links`);
  return links;
}

// ─── Phase 2: scrape a single detail page ────────────────────────────────────

async function scrapeDetail(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await wait(3000); // let Wix JS render
    await humanScroll(page);

    const data = await page.evaluate(() => {
      const clean = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);

      const result = {
        _sourceUrl: window.location.href,
        name: null, address: null, phone: null, website: null,
        nusach: null, rabbi: null, gabbai: null, hours: null,
        neighborhood: null, notes: null,
        raw_fields: {},
      };

      // Name from heading
      result.name = clean(document.querySelector('h1, h2, .blog-post-title, [class*="title"]'));

      // All text → key:value pairs
      const fullText = document.body.innerText || '';

      // Strategy A: explicit label patterns
      const labelMap = {
        address:      ['כתובת', 'רחוב', 'כתובת בית הכנסת'],
        phone:        ['טלפון', 'פלאפון', 'נייד', 'טל'],
        nusach:       ['נוסח', 'נוסח תפילה', 'מנהג'],
        rabbi:        ['רב', 'רב הקהילה', 'מרא דאתרא'],
        gabbai:       ['גבאי', 'שמש'],
        hours:        ['זמני תפילה', 'שעות תפילה', 'זמנים', 'שעות'],
        neighborhood: ['שכונה'],
        notes:        ['הערות', 'מידע נוסף', 'תיאור'],
      };

      // Scan all elements for label: value pattern
      document.querySelectorAll('p, li, span, div, td').forEach((el) => {
        const text = clean(el);
        if (!text || text.length > 500 || el.children.length > 3) return;
        const m = text.match(/^([^:：]{2,25})[：:]\s*(.{1,200})$/);
        if (m) result.raw_fields[m[1].trim()] = m[2].trim();
      });

      // Map raw_fields → structured
      for (const [key, labels] of Object.entries(labelMap)) {
        if (result[key]) continue;
        for (const lbl of labels) {
          for (const [k, v] of Object.entries(result.raw_fields)) {
            if (k.includes(lbl)) { result[key] = v; break; }
          }
          if (result[key]) break;
        }
      }

      // Phone regex fallback
      if (!result.phone) {
        const m = fullText.match(/0[5-9][0-9]-?\s*[0-9]{3}-?\s*[0-9]{4}/);
        if (m) result.phone = m[0];
      }

      // Address regex fallback
      if (!result.address) {
        const m = fullText.match(/[א-ת][א-ת\s'"-]{2,25}\s+\d{1,3}/u);
        if (m) result.address = m[0].trim();
      }

      // Website/link in page
      const links = [...document.querySelectorAll('a[href]')]
        .map((a) => a.href)
        .filter((h) => h.startsWith('http') && !h.includes('gederamd.org') && !h.includes('wix'));
      if (links.length) result.website = links[0];

      return result;
    });

    return data;
  } catch (err) {
    logErr(`Error scraping ${url}: ${err.message}`);
    return { _sourceUrl: url, error: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`===  Gedera Synagogue Scraper  ===`);
  log(`Output: ${OUTPUT_FILE}`);

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

  // Phase 1: collect links
  const allLinks = await collectLinks(page);

  if (DEBUG) { await browser.close(); return; }

  const toScrape = allLinks.filter((l) => !doneUrls.has(l.url));
  log(`To scrape: ${toScrape.length}  (${doneUrls.size} already done)`);

  // Phase 2: scrape each detail page
  for (let i = 0; i < toScrape.length; i++) {
    const { url, text } = toScrape[i];
    log(`\n[${i + 1}/${toScrape.length}] ${text || url}`);

    const raw = await scrapeDetail(page, url);

    if (!raw.error) {
      log(`  ✓  name="${raw.name}"  addr="${raw.address}"`);
    }

    results.push(raw);
    doneUrls.add(url);
    saveProgress(results);

    await humanDelay(DETAIL_DELAY_MIN, DETAIL_DELAY_MAX);
  }

  await browser.close();

  // Build import file
  const importRows = results
    .filter((r) => !r.error)
    .map(toImportRow);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(importRows, null, 2), 'utf-8');
  log(`\nDone! ${importRows.length} synagogues saved to ${OUTPUT_FILE}`);
}

process.on('SIGINT', () => {
  log('Interrupted — progress saved.');
  process.exit(0);
});

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
