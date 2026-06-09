'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DESTINATION_ID = 334;
const CITY           = 'בני ברק';
const GMAPS_URL      = 'https://www.google.com/maps/search/%D7%91%D7%99%D7%AA+%D7%9B%D7%A0%D7%A1%D7%AA+%D7%91%D7%A0%D7%99+%D7%91%D7%A8%D7%A7%E2%80%AD/@32.0832842,34.8547716,14z?hl=iw';
const OUTPUT_FILE    = path.join(__dirname, 'bnei_brak_synagogues.json');
const PROGRESS_FILE  = path.join(__dirname, 'bnei_brak_progress.json');

const HEADED = process.argv.includes('--headed');

function ts()  { return new Date().toLocaleTimeString('he-IL', { hour12: false }); }
const log = (m) => console.log(`[${ts()}] ${m}`);
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { results: [], doneUrls: [] };
  try {
    const d = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    log(`▶ Resumed: ${d.results.length} synagogues scraped so far`);
    return d;
  } catch { return { results: [], doneUrls: [] }; }
}

function saveProgress(results, doneUrls) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ results, doneUrls }, null, 2), 'utf-8');
}

function coordsFromUrl(url) {
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  const m2 = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m2) return { lat: parseFloat(m2[1]), lon: parseFloat(m2[2]) };
  return null;
}

async function scrollToLoadAll(page) {
  const feed = 'div[role="feed"]';
  await page.waitForSelector(feed, { timeout: 15000 });

  let prevCount = 0;
  let noNewCount = 0;

  while (true) {
    const count = await page.$$eval('a[href*="/maps/place/"]', els => els.length);

    if (count === prevCount) {
      noNewCount++;
      if (noNewCount >= 4) {
        const endMsg = await page.$('span:has-text("הגעת לסוף הרשימה")');
        const endMsg2 = await page.$('span:has-text("אין עוד תוצאות")');
        if (endMsg || endMsg2 || noNewCount >= 8) {
          log(`✅ Loaded all cards (total: ${count} place links)`);
          break;
        }
      }
    } else {
      noNewCount = 0;
      log(`  Scrolling... ${count} places loaded`);
    }

    prevCount = count;

    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollBy(0, 1200);
    }, feed);

    await wait(1500);
  }
}

(async () => {
  const { results, doneUrls } = loadProgress();

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    locale: 'he-IL',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  log('🌐 Opening Google Maps...');
  await page.goto(GMAPS_URL, { waitUntil: 'load', timeout: 60000 });
  await wait(3000);

  const cookieBtn = await page.$('button:has-text("אישור הכל"), button:has-text("Accept all"), button:has-text("Reject all")');
  if (cookieBtn) { await cookieBtn.click(); await wait(1000); }

  log('📜 Scrolling to load all results...');
  await scrollToLoadAll(page);

  const rawLinks = await page.$$eval('a[href*="/maps/place/"]', links =>
    links.map(a => ({
      name: (a.getAttribute('aria-label') || '').trim(),
      href: a.href,
    })).filter(l => l.href.includes('/maps/place/'))
  );

  const seen = new Set();
  const placeLinks = [];
  for (const l of rawLinks) {
    const key = l.href.split('?')[0];
    if (!seen.has(key)) { seen.add(key); placeLinks.push(l); }
  }

  log(`📋 Found ${placeLinks.length} unique places`);

  let newCount = 0;

  for (let i = 0; i < placeLinks.length; i++) {
    const { href, name: peekName } = placeLinks[i];
    const urlKey = href.split('?')[0];

    if (doneUrls.includes(urlKey)) {
      log(`  [${i + 1}/${placeLinks.length}] ⏭ Skip: ${peekName}`);
      continue;
    }

    log(`  [${i + 1}/${placeLinks.length}] 🔍 ${peekName || '...'}`);

    try {
      await page.goto(href, { waitUntil: 'load', timeout: 30000 });
      await wait(1500);

      const name = await page.$eval('h1', el => el.innerText.trim()).catch(() => peekName || null);
      if (!name) { log(`     ⚠️ No name, skip`); continue; }

      let address = await page.$$eval(
        'button[data-item-id="address"] .Io6YTe, [data-tooltip="העתק כתובת"] .Io6YTe',
        els => els[0]?.innerText?.trim() || null
      ).catch(() => null);
      if (!address) {
        address = await page.$eval('[aria-label*="כתובת"]', el => el.innerText?.trim()).catch(() => null);
      }
      if (address && !address.includes(CITY) && !address.includes('בני ברק')) {
        address = `${address}, ${CITY}`;
      }
      if (!address) address = CITY;

      const phone = await page.$$eval('[data-item-id^="phone:tel:"] .Io6YTe',
        els => els[0]?.innerText?.trim() || null
      ).catch(() => null);

      const coords = coordsFromUrl(page.url()) || coordsFromUrl(href);

      results.push({
        name,
        address,
        phone: phone || null,
        latitude:  coords?.lat ?? null,
        longitude: coords?.lon ?? null,
        destinationId: DESTINATION_ID,
      });
      doneUrls.push(urlKey);
      newCount++;
      log(`     ✅ ${name} | ${address} | ${coords?.lat?.toFixed(5)}, ${coords?.lon?.toFixed(5)}`);
      saveProgress(results, doneUrls);

    } catch (e) {
      log(`     ⚠️ Error: ${e.message.split('\n')[0]}`);
    }

    await page.goBack({ waitUntil: 'load', timeout: 15000 }).catch(() => {});
    await wait(800);

    if ((i + 1) % 10 === 0) {
      log(`  ⏸ Short pause (anti-block)...`);
      await wait(3000);
    }
  }

  await browser.close();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  log(`\n✅ Done! ${results.length} synagogues saved to bnei_brak_synagogues.json`);
  log(`   (${newCount} new this run)`);
})();
