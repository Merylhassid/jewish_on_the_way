'use strict';

/**
 * Ashdod Synagogue Scraper — Google Maps
 * Source: https://www.google.com/maps/search/בית+כנסת+אשדוד
 * Destination ID: 364
 *
 * Usage:
 *   node scrape-ashdod-gmaps.js            → headless
 *   node scrape-ashdod-gmaps.js --headed   → visible browser (recommended first run)
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DESTINATION_ID = 364;
const CITY           = 'אשדוד';
const GMAPS_URL      = 'https://www.google.com/maps/search/%D7%91%D7%99%D7%AA+%D7%9B%D7%A0%D7%A1%D7%AA+%D7%90%D7%A9%D7%93%D7%95%D7%93/@31.793353,34.6451026,14z/data=!4m2!2m1!6e1?hl=iw';
const OUTPUT_FILE    = path.join(__dirname, 'ashdod_synagogues.json');
const PROGRESS_FILE  = path.join(__dirname, 'ashdod_progress.json');

const HEADED = process.argv.includes('--headed');

function ts()  { return new Date().toLocaleTimeString('he-IL', { hour12: false }); }
const log = (m) => console.log(`[${ts()}] ${m}`);
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { results: [], doneNames: [] };
  try {
    const d = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    log(`▶ Resumed: ${d.results.length} synagogues scraped so far`);
    return d;
  } catch { return { results: [], doneNames: [] }; }
}

function saveProgress(results) {
  const doneNames = results.map(r => r.name);
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ results, doneNames }, null, 2), 'utf-8');
}

// Extract lat/lon from Google Maps URL  e.g. !3d31.1234!4d34.5678
function coordsFromUrl(url) {
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  return null;
}

// Scroll the results panel until no new cards appear
async function scrollToLoadAll(page) {
  const feed = 'div[role="feed"]';
  await page.waitForSelector(feed, { timeout: 15000 });

  let prevCount = 0;
  let noNewCount = 0;

  while (true) {
    // Count current cards
    const count = await page.$$eval(`${feed} > div`, els => els.length);

    if (count === prevCount) {
      noNewCount++;
      if (noNewCount >= 4) {
        // Check if "end of list" message appeared
        const endMsg = await page.$('span:has-text("הגעת לסוף הרשימה")');
        const endMsg2 = await page.$('span:has-text("אין עוד תוצאות")');
        if (endMsg || endMsg2 || noNewCount >= 8) {
          log(`✅ Loaded all cards (total: ${count})`);
          break;
        }
      }
    } else {
      noNewCount = 0;
      log(`  Scrolling... ${count} cards loaded`);
    }

    prevCount = count;

    // Scroll the feed panel down
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollBy(0, 1200);
    }, feed);

    await wait(1500);
  }
}

// Click a result card and extract details from the detail panel
async function scrapeDetail(page, cardIndex) {
  try {
    // Re-fetch cards each time (DOM may shift)
    const cards = await page.$$('div[role="feed"] > div');
    const card  = cards[cardIndex];
    if (!card) return null;

    // Click the card
    await card.click();

    // Wait for detail panel — look for h1 (place name)
    await page.waitForSelector('h1', { timeout: 8000 });
    await wait(1000); // let phone/address settle

    // Extract name
    const name = await page.$eval('h1', el => el.innerText.trim()).catch(() => null);
    if (!name) return null;

    // Extract address
    const address = await page.$$eval('button[data-item-id="address"] .Io6YTe, [data-tooltip="העתק כתובת"] .Io6YTe', els =>
      els[0]?.innerText?.trim() || null
    ).catch(() => null);

    // Fallback address selector
    let finalAddress = address;
    if (!finalAddress) {
      finalAddress = await page.$eval('[aria-label*="כתובת"]', el => el.innerText?.trim()).catch(() => null);
    }

    // Append city if not present
    if (finalAddress && !finalAddress.includes(CITY) && !finalAddress.includes('אשדוד')) {
      finalAddress = `${finalAddress}, ${CITY}`;
    }
    if (!finalAddress) finalAddress = CITY;

    // Extract phone
    const phone = await page.$$eval('[data-item-id^="phone:tel:"] .Io6YTe', els =>
      els[0]?.innerText?.trim() || null
    ).catch(() => null);

    // Extract coordinates from current URL
    const url    = page.url();
    const coords = coordsFromUrl(url);

    return { name, address: finalAddress, phone: phone || null, ...coords };

  } catch (e) {
    log(`  ⚠️ Error on card ${cardIndex}: ${e.message}`);
    return null;
  }
}

(async () => {
  const { results, doneNames } = loadProgress();

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    locale: 'he-IL',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  log('🌐 Opening Google Maps...');
  await page.goto(GMAPS_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await wait(3000);

  // Dismiss cookie banner if present
  const cookieBtn = await page.$('button:has-text("אישור הכל"), button:has-text("Accept all")');
  if (cookieBtn) { await cookieBtn.click(); await wait(1000); }

  log('📜 Scrolling to load all results...');
  await scrollToLoadAll(page);

  const totalCards = await page.$$eval('div[role="feed"] > div', els => els.length);
  log(`📋 Found ${totalCards} cards total`);

  let newCount = 0;

  for (let i = 0; i < totalCards; i++) {
    // Peek at card name before clicking (to skip already-done)
    const cards    = await page.$$('div[role="feed"] > div');
    const cardText = await cards[i]?.evaluate(el => el.innerText?.split('\n')[0]?.trim()).catch(() => '');

    if (cardText && doneNames.includes(cardText)) {
      log(`  [${i + 1}/${totalCards}] ⏭ Skip (already done): ${cardText}`);
      continue;
    }

    log(`  [${i + 1}/${totalCards}] 🔍 ${cardText || '...'}`);

    const detail = await scrapeDetail(page, i);

    if (detail && detail.name) {
      if (!doneNames.includes(detail.name)) {
        results.push({
          name:        detail.name,
          address:     detail.address,
          phone:       detail.phone,
          latitude:    detail.lat  ?? null,
          longitude:   detail.lon  ?? null,
          destinationId: DESTINATION_ID,
        });
        doneNames.push(detail.name);
        newCount++;
        log(`     ✅ ${detail.name} | ${detail.address} | ${detail.lat?.toFixed(5)}, ${detail.lon?.toFixed(5)}`);
        saveProgress(results);
      }
    }

    // Go back to results list
    const backBtn = await page.$('button[aria-label="חזרה לתוצאות החיפוש"], button[aria-label="Back to results"]');
    if (backBtn) await backBtn.click();
    else await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await wait(800);

    // Polite delay every 10 items
    if ((i + 1) % 10 === 0) {
      log(`  ⏸ Short pause (anti-block)...`);
      await wait(3000);
    }
  }

  await browser.close();

  // Save final JSON in import format
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  log(`\n✅ Done! ${results.length} synagogues saved to ashdod_synagogues.json`);
  log(`   (${newCount} new this run)`);
})();
