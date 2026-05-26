const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://mdmaad.glide.page/dl/d0a5f4';
const DEST_ID = 343;
const CITY = 'מעלה אדומים';

const SEL_ADDR  = 'p[class*="card-collection-card___StyledP-sc"]';
const SEL_NAME  = 'h3[class*="card-collection-card___StyledH-sc"]';
const SEL_DENOM = 'p[class*="card-collection-card___StyledP2-sc"]';
// Each "card" wrapper
const SEL_CARD  = '[class*="card-collection-card___Styled"]';

async function waitForCards(page) {
  await page.waitForSelector(SEL_NAME, { timeout: 20000 });
}

async function getCardCount(page) {
  return (await page.$$(SEL_NAME)).length;
}

async function scrollToLoadAll(page) {
  let prev = 0;
  for (let attempt = 0; attempt < 30; attempt++) {
    const count = await getCardCount(page);
    if (count === prev && attempt > 2) break;
    prev = count;
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(600);
  }
  // scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function extractListCards(page) {
  return page.evaluate(({ selName, selAddr, selDenom }) => {
    const names  = [...document.querySelectorAll(selName)].map(el => el.innerText.trim());
    const addrs  = [...document.querySelectorAll(selAddr)].map(el => el.innerText.trim());
    const denoms = [...document.querySelectorAll(selDenom)].map(el => el.innerText.trim());
    const results = [];
    for (let i = 0; i < names.length; i++) {
      results.push({ name: names[i], address: addrs[i] || '', denomination: denoms[i] || '' });
    }
    return results;
  }, { selName: SEL_NAME, selAddr: SEL_ADDR, selDenom: SEL_DENOM });
}

async function extractDetailPage(page) {
  const text = await page.evaluate(() => document.body.innerText);
  // Parse label: value pairs from detail
  const get = (label) => {
    const re = new RegExp(label + '\\s*\\n([^\\n]+)');
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  const address     = get('כתובת בית הכנסת');
  const denomination= get('נוסח');
  const website     = get('קישור לאתר') || get('קישור');
  const phone       = get('טלפון') || get('מספר טלפון');

  // Prayer times — everything between "הערות" or "זמני" and "זמן עדכון"
  let description = null;
  const prayerRe = /(?:הערות|זמני תפילה)[^\n]*\n([\s\S]+?)(?:\nזמן עדכון|$)/;
  const pm = text.match(prayerRe);
  if (pm) {
    const raw = pm[1].trim();
    if (raw.length > 3) description = raw;
  }

  return { address, denomination, website, phone, description };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const page = await ctx.newPage();

  console.log('Loading page...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  console.log('Waiting 10s for app to render...');
  await page.waitForTimeout(10000);

  await waitForCards(page);
  console.log('Scrolling to load all cards...');
  await scrollToLoadAll(page);

  const cards = await extractListCards(page);
  console.log(`Found ${cards.length} cards in list view`);
  // Filter out the test entry
  const filtered = cards.filter(c => !c.name.includes('לדוגמא') && c.name.length > 1);
  console.log(`After filter: ${filtered.length} cards\n`);

  const results = [];

  for (let i = 0; i < filtered.length; i++) {
    const card = filtered[i];
    console.log(`[${i+1}/${filtered.length}] ${card.name}`);

    // Click the card by finding its H3 by text
    let clicked = false;
    try {
      const h3s = await page.$$(SEL_NAME);
      for (const h3 of h3s) {
        const t = await h3.evaluate(el => el.innerText.trim());
        if (t === card.name) {
          await h3.scrollIntoViewIfNeeded();
          await h3.click();
          clicked = true;
          break;
        }
      }
    } catch (e) {
      console.log(`  Click error: ${e.message}`);
    }

    if (!clicked) {
      console.log(`  Could not click — using list data only`);
      results.push(card);
      continue;
    }

    await page.waitForTimeout(1500);

    // Extract detail
    const detail = await extractDetailPage(page);

    const entry = {
      name: card.name,
      address: detail.address || card.address,
      denomintion: detail.denomination || card.denomination,
      destinationId: DEST_ID,
    };
    if (detail.denomination || card.denomination) entry.denomination = detail.denomination || card.denomination;
    if (detail.website) entry.website = detail.website;
    if (detail.phone) entry.phone = detail.phone;
    if (detail.description) entry.description = detail.description;

    // Ensure city suffix
    if (entry.address && !entry.address.includes(CITY)) entry.address = `${entry.address}, ${CITY}`;
    if (!entry.address) entry.address = CITY;

    console.log(`  ✓ ${entry.address} | ${entry.denomination || ''}`);
    results.push(entry);

    // Go back
    await page.goBack();
    await page.waitForTimeout(1500);
    await waitForCards(page).catch(() => page.waitForTimeout(2000));
  }

  await browser.close();

  // Remove the erroneous 'denomintion' key
  const clean = results.map(({ denomintion, ...rest }) => rest);

  console.log(`\n=== Total: ${clean.length} synagogues ===`);
  const outPath = path.join(__dirname, '..', 'import-maale-adumim-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(clean, null, 2), 'utf8');
  console.log('Saved to import-maale-adumim-synagogues.json');
})();
