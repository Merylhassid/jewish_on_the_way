/**
 * Rabanut.co.il Synagogue Scraper  –  v2 (anti-429, human-like)
 *
 * Usage:
 *   node scrape.js              → headless, auto-resumes from progress.json if exists
 *   node scrape.js --headed     → visible browser
 *   node scrape.js --debug      → dump first list-page HTML then exit
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL        = 'https://rabanut.co.il';
const LIST_START_URL  = 'https://rabanut.co.il/%D7%97%D7%99%D7%A4%D7%95%D7%A9-%D7%91%D7%AA%D7%99-%D7%9B%D7%A0%D7%A1%D7%AA-%D7%91%D7%A2%D7%99%D7%A8/';
const OUTPUT_FILE     = path.join(__dirname, 'synagogues.json');
const PROGRESS_FILE   = path.join(__dirname, 'progress.json');
const HTML_DUMP_FILE  = path.join(__dirname, 'debug-page.html');

// Delays in seconds (randomised each time)
const DETAIL_DELAY_MIN  =  5;   // seconds between synagogue pages
const DETAIL_DELAY_MAX  = 12;
const LIST_DELAY_MIN    = 10;   // seconds between pagination pages
const LIST_DELAY_MAX    = 20;

// ─── CLI flags ────────────────────────────────────────────────────────────────

const HEADED = process.argv.includes('--headed');
const DEBUG  = process.argv.includes('--debug');

// ─── Logging ─────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString('he-IL', { hour12: false });
}
const log     = (m) => console.log(`[${ts()}] ${m}`);
const logWarn = (m) => console.warn(`[${ts()}] ⚠️  ${m}`);
const logErr  = (m) => console.error(`[${ts()}] ✗  ${m}`);
function logSection(m) {
  console.log(`\n${'─'.repeat(62)}\n  ${m}\n${'─'.repeat(62)}`);
}

// ─── Delay helpers ────────────────────────────────────────────────────────────

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Random delay between [minSec, maxSec] seconds — logs it so you can watch */
async function humanDelay(minSec, maxSec, label = '') {
  const sec = +(Math.random() * (maxSec - minSec) + minSec).toFixed(1);
  log(`  ⏱  Waiting ${sec}s${label ? ' ' + label : ''}…`);
  await wait(sec * 1000);
}

/** Random scroll to simulate a human reading the page */
async function humanScroll(page) {
  try {
    await page.evaluate(() => {
      const h = document.body.scrollHeight;
      const targets = [
        h * (0.2 + Math.random() * 0.2),
        h * (0.5 + Math.random() * 0.2),
      ];
      for (const y of targets) {
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
    await wait(400 + Math.random() * 600);
    // Scroll back near top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await wait(200 + Math.random() * 300);
  } catch {
    // non-fatal
  }
}

// ─── 429 guard ───────────────────────────────────────────────────────────────

let got429 = false;

function install429Guard(page) {
  page.on('response', (resp) => {
    if (resp.status() === 429) {
      got429 = true;
      logWarn('HTTP 429 Too Many Requests — will stop after saving progress.');
    }
  });
}

// ─── Progress file helpers ────────────────────────────────────────────────────

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { results: [], scrapedUrls: new Set(), scrapedNames: new Set() };
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    const results = data.results || [];
    const scrapedUrls  = new Set(results.map((r) => r.url).filter(Boolean));
    const scrapedNames = new Set(results.map((r) => r.name).filter(Boolean));
    log(`Auto-resumed: ${results.length} previously scraped items loaded.`);
    return { results, scrapedUrls, scrapedNames };
  } catch (e) {
    logWarn(`Could not parse progress.json (${e.message}) — starting fresh.`);
    return { results: [], scrapedUrls: new Set(), scrapedNames: new Set() };
  }
}

function saveProgress(results) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ scrapedAt: new Date().toISOString(), results }, null, 2),
    'utf-8'
  );
}

function saveFinalOutput(results) {
  // Deduplicate by URL first, then by name
  const byUrl  = new Map();
  const byName = new Map();
  const unique = [];

  for (const item of results) {
    if (item.url  && byUrl.has(item.url))   continue;
    if (item.name && byName.has(item.name)) continue;
    if (item.url)  byUrl.set(item.url, true);
    if (item.name) byName.set(item.name, true);
    unique.push(item);
  }

  const output = {
    scraped_at: new Date().toISOString(),
    total: unique.length,
    source: LIST_START_URL,
    synagogues: unique,
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  return unique.length;
}

// ─── Phase 1 – collect synagogue URLs from list pages ────────────────────────

async function scrapeListPage(page, url, pageNum) {
  log(`\n→ List page ${pageNum}: ${url}`);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });

  if (resp && resp.status() === 429) {
    got429 = true;
    logWarn('429 on list page — aborting collection phase.');
    return { synagogueUrls: [], nextPageUrl: null };
  }

  await humanScroll(page);

  if (DEBUG) {
    fs.writeFileSync(HTML_DUMP_FILE, await page.content(), 'utf-8');
    log(`DEBUG: HTML dumped to ${HTML_DUMP_FILE}`);
    return { synagogueUrls: [], nextPageUrl: null };
  }

  const result = await page.evaluate((baseUrl) => {
    const nextPageCandidates = [
      document.querySelector('a[rel="next"]'),
      document.querySelector('.nav-links a.next'),
      document.querySelector('.pagination a.next'),
      document.querySelector('a.next.page-numbers'),
      [...document.querySelectorAll('a')].find(
        (a) => a.textContent.trim() === 'הבא' || a.textContent.trim() === '»'
      ),
    ];
    const nextPageUrl = (nextPageCandidates.find(Boolean) || {}).href || null;

    const excludedEls = new Set(
      [...document.querySelectorAll('header, nav, footer, #header, #nav, #footer, .site-header, .site-footer, .widget, .sidebar')]
        .flatMap((el) => [el, ...el.querySelectorAll('*')])
    );

    const links = [];
    document.querySelectorAll('a[href]').forEach((a) => {
      if (excludedEls.has(a)) return;
      const href = a.href;
      if (!href || !href.startsWith(baseUrl)) return;
      try {
        const u = new URL(href);
        const p = u.pathname;
        if (!p || p === '/') return;
        if (/\/(wp-|page\/|category\/|tag\/|feed\/)/.test(p)) return;
        if (u.search !== '' || u.hash !== '') return;
        if (decodeURIComponent(p).includes('חיפוש') || p.includes('%D7%97%D7%99%D7%A4%D7%95%D7%A9')) return;
        const parts = p.split('/').filter(Boolean);
        if (parts.length < 1 || parts.length > 3) return;
        links.push(href);
      } catch { /* ignore */ }
    });

    const titleEl = document.querySelector('h1, .page-title, .entry-title');
    return {
      synagogueUrls: [...new Set(links)],
      nextPageUrl,
      pageTitle: titleEl ? titleEl.textContent.trim() : '(no title)',
    };
  }, BASE_URL);

  log(`  Title: "${result.pageTitle}"  |  Found: ${result.synagogueUrls.length} links  |  Next: ${result.nextPageUrl ?? 'none'}`);
  return { synagogueUrls: result.synagogueUrls, nextPageUrl: result.nextPageUrl };
}

// ─── Phase 2 – extract data from a single detail page ────────────────────────

const FIELD_PATTERNS = [
  { key: 'name',         labels: ['שם בית הכנסת', 'שם'] },
  { key: 'address',      labels: ['כתובת', 'רחוב', 'כתובת בית הכנסת'] },
  { key: 'city',         labels: ['עיר', 'יישוב'] },
  { key: 'neighborhood', labels: ['שכונה'] },
  { key: 'phone',        labels: ['טלפון', 'פלאפון', 'נייד', 'טלפון נייד'] },
  { key: 'nusach',       labels: ['נוסח', 'נוסח תפילה', 'מנהג'] },
  { key: 'rabbi',        labels: ['רב', 'רב הקהילה', 'מרא דאתרא'] },
  { key: 'gabbai',       labels: ['גבאי', 'שמש'] },
  { key: 'hours',        labels: ['שעות', 'זמני תפילה', 'שעות תפילה', 'זמנים'] },
  { key: 'notes',        labels: ['הערות', 'מידע נוסף', 'תיאור', 'פרטים נוספים'] },
];

async function scrapeDetailPage(page, url) {
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });

    if (resp && resp.status() === 429) {
      got429 = true;
      logWarn('429 on detail page — marking for retry.');
      return { url, error: '429 Too Many Requests' };
    }

    await humanScroll(page);

    const data = await page.evaluate((fieldPatterns) => {
      const clean = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);

      const result = { url: window.location.href, raw_fields: {} };
      fieldPatterns.forEach(({ key }) => (result[key] = null));

      // Name from h1
      result.name = clean(document.querySelector('h1.entry-title, h1.page-title, h1'));

      // Strategy A: table rows
      document.querySelectorAll('table tr').forEach((tr) => {
        const cells = tr.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const label = clean(cells[0]);
          const value = clean(cells[1]);
          if (label && value) result.raw_fields[label] = value;
        }
      });

      // Strategy B: definition lists
      document.querySelectorAll('dt').forEach((dt) => {
        const dd = dt.nextElementSibling;
        if (dd?.tagName === 'DD') {
          const label = clean(dt);
          const value = clean(dd);
          if (label && value) result.raw_fields[label] = value;
        }
      });

      // Strategy C: ACF / plugin field divs
      const fieldSel = ['.acf-field','.pods-field','.cmb-row','.mb-row',
        '[class*="field-row"]','[class*="info-row"]','[class*="meta-row"]','[class*="detail-row"]'].join(',');
      document.querySelectorAll(fieldSel).forEach((row) => {
        const labelEl = row.querySelector('.acf-label label, .label, .field-label, strong, b');
        const valueEl = row.querySelector('.acf-input, .value, .field-value');
        if (labelEl && valueEl) {
          const label = clean(labelEl);
          const value = clean(valueEl);
          if (label && value) result.raw_fields[label] = value;
        }
      });

      // Strategy D: "Label: Value" in paragraphs
      document.querySelectorAll(
        '.entry-content p, .entry-content li, .entry-content span, .post-content p, .post-content li, .content p'
      ).forEach((el) => {
        const text = clean(el);
        if (!text || text.length > 300) return;
        const m = text.match(/^([^:：]{2,30})[：:]\s*(.+)$/);
        if (m) result.raw_fields[m[1].trim()] = m[2].trim();
      });

      // Map raw_fields → structured keys
      for (const { key, labels } of fieldPatterns) {
        if (result[key]) continue;
        for (const label of labels) {
          for (const [rawLabel, rawValue] of Object.entries(result.raw_fields)) {
            if (rawLabel.includes(label)) { result[key] = rawValue; break; }
          }
          if (result[key]) break;
        }
      }

      // Regex fallbacks for phone / address
      const fullText = document.body.innerText;
      if (!result.phone) {
        const m = fullText.match(/0[5-9][0-9]-?[0-9]{3}-?[0-9]{4}/);
        if (m) result.phone = m[0];
      }
      if (!result.address) {
        const m = fullText.match(/[א-ת][א-ת\s'"-]{3,30}\s+\d+/u);
        if (m) result.address = m[0].trim();
      }

      return result;
    }, FIELD_PATTERNS);

    return data;
  } catch (err) {
    logErr(`Error scraping ${url}: ${err.message}`);
    return { url, error: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  logSection('Rabanut.co.il Synagogue Scraper  v2');
  log(`Browser: ${HEADED ? 'headed (visible)' : 'headless'}`);
  log(`Debug:   ${DEBUG}`);
  log(`Output:  ${OUTPUT_FILE}`);

  // Always auto-resume from progress.json if it exists
  const { results, scrapedUrls, scrapedNames } = loadProgress();

  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'DNT': '1',
    },
  });

  const page = await context.newPage();
  install429Guard(page);

  // Hide webdriver property to avoid bot detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  // ── Phase 1: Collect all synagogue URLs ──────────────────────────────────────

  logSection('Phase 1 — Collecting synagogue URLs');
  const allSynagogueUrls = [];
  const seenListUrls = new Set();
  let currentListUrl = LIST_START_URL;
  let listPageNum = 1;

  while (currentListUrl && !got429) {
    if (seenListUrls.has(currentListUrl)) { log('Pagination loop detected — stopping.'); break; }
    seenListUrls.add(currentListUrl);

    const { synagogueUrls, nextPageUrl } = await scrapeListPage(page, currentListUrl, listPageNum);

    if (DEBUG) break;

    for (const u of synagogueUrls) {
      if (!allSynagogueUrls.includes(u)) allSynagogueUrls.push(u);
    }
    log(`  Cumulative unique URLs collected: ${allSynagogueUrls.length}`);

    if (got429) { logWarn('Stopping list collection due to 429.'); break; }

    if (nextPageUrl && nextPageUrl !== currentListUrl && !seenListUrls.has(nextPageUrl)) {
      currentListUrl = nextPageUrl;
      listPageNum++;
      await humanDelay(LIST_DELAY_MIN, LIST_DELAY_MAX, 'before next list page');
    } else {
      log('No more list pages.');
      break;
    }
  }

  if (DEBUG) {
    log('Debug mode: done.');
    await browser.close();
    return;
  }

  // ── Phase 2: Scrape each synagogue detail page ───────────────────────────────

  // Filter to only URLs not yet scraped (by URL or by name)
  const toScrape = allSynagogueUrls.filter((u) => !scrapedUrls.has(u));
  logSection(`Phase 2 — Scraping ${toScrape.length} new synagogues (${scrapedUrls.size} already done)`);

  let newCount = 0;
  let errorCount = 0;
  let skipped = 0;

  for (let i = 0; i < toScrape.length; i++) {
    if (got429) {
      logWarn('429 detected — stopping scrape loop and saving progress.');
      break;
    }

    const url = toScrape[i];
    const pct = (((i + 1) / toScrape.length) * 100).toFixed(1);
    log(`\n[${i + 1}/${toScrape.length}] (${pct}%) → ${url}`);

    const data = await scrapeDetailPage(page, url);

    // Skip duplicate names
    if (data.name && scrapedNames.has(data.name)) {
      log(`  SKIP duplicate name: "${data.name}"`);
      skipped++;
      continue;
    }

    if (data.error) {
      errorCount++;
      if (data.error.includes('429')) {
        logWarn('Stopping due to 429.');
        break;
      }
    } else {
      newCount++;
      if (data.name) scrapedNames.add(data.name);
      log(`  ✓  "${data.name ?? '(no name)'}"`);
    }

    results.push(data);
    scrapedUrls.add(url);

    // Save after EVERY item
    saveProgress(results);

    if (!got429) {
      await humanDelay(DETAIL_DELAY_MIN, DETAIL_DELAY_MAX, 'before next synagogue');
    }
  }

  // ── Final output ─────────────────────────────────────────────────────────────

  const totalUnique = saveFinalOutput(results);

  logSection('Summary');
  log(`New scraped:        ${newCount}`);
  log(`Skipped (dup name): ${skipped}`);
  log(`Errors:             ${errorCount}`);
  log(`Total in output:    ${totalUnique}`);
  log(`Output file:        ${OUTPUT_FILE}`);
  if (got429) {
    logWarn('Run stopped early due to HTTP 429. Re-run the same command tomorrow to continue.');
    logWarn('Progress is saved — no data was lost.');
  } else {
    log('All done! progress.json can be deleted if you no longer need to resume.');
  }

  await browser.close();
}

// Catch Ctrl-C gracefully
process.on('SIGINT', () => {
  logWarn('Interrupted by user (Ctrl-C). Progress was saved after each item.');
  process.exit(0);
});

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
