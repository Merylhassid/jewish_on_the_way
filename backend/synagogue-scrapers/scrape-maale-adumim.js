const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://mdmaad.glide.page/dl/d0a5f4';
const DEST_ID = 343;
const CITY = 'מעלה אדומים';

async function waitAndGet(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return await page.$(selector);
  } catch { return null; }
}

(async () => {
  const browser = await chromium.launch({ headless: false }); // visible so we can debug
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const page = await ctx.newPage();

  console.log('Loading main page...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);

  // Collect all card titles from the list
  // Glide renders cards as list items — wait for them to appear
  await page.waitForSelector('[data-testid="list-item"], .list-item, [class*="ListItem"], [class*="Card"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Get all clickable cards by looking for the name + address pattern
  const cardCount = await page.evaluate(() => {
    // Try various selectors Glide uses
    const selectors = [
      '[data-testid="list-item"]',
      '[class*="ListItem"]',
      '[class*="list-item"]',
      '[class*="Card"]',
      '[class*="card"]',
      '.wireframe-list-item',
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        console.log('Found with selector:', sel, els.length);
        return els.length;
      }
    }
    return 0;
  });
  console.log(`Found ${cardCount} cards`);

  // Take a screenshot to see current state
  await page.screenshot({ path: path.join(__dirname, 'maale_adumim_main.png') });
  console.log('Screenshot saved: maale_adumim_main.png');

  // Get all card elements and their text for identification
  const cardTexts = await page.evaluate(() => {
    const selectors = [
      '[data-testid="list-item"]',
      '[class*="ListItem"]',
      '[class*="list-item"]',
      '[class*="Card"]',
      '.wireframe-list-item',
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        return Array.from(els).map((el, i) => ({
          index: i,
          text: el.innerText?.substring(0, 100)
        }));
      }
    }
    // fallback: get all clickable items
    return [];
  });

  console.log('Card texts sample:', cardTexts.slice(0, 5));

  const results = [];

  // Click each card one by one
  for (let i = 0; i < Math.max(cardCount, cardTexts.length); i++) {
    console.log(`\nProcessing card ${i + 1}/${Math.max(cardCount, cardTexts.length)}...`);

    // Re-find cards after each navigation back
    const cards = await page.$$('[data-testid="list-item"], [class*="ListItem"], [class*="list-item"], [class*="Card"], .wireframe-list-item');

    if (i >= cards.length) {
      console.log('No more cards');
      break;
    }

    const card = cards[i];
    const cardText = await card.evaluate(el => el.innerText || '');
    console.log(`  Card text: ${cardText.substring(0, 80)}`);

    // Click the card
    await card.click();
    await page.waitForTimeout(2000);

    // Extract detail page content
    const detail = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return { bodyText, url: window.location.href };
    });

    console.log(`  Detail URL: ${detail.url}`);
    console.log(`  Detail text (first 300): ${detail.bodyText.substring(0, 300)}`);

    // Parse fields from the detail page text
    const text = detail.bodyText;

    // Extract name
    let name = null;
    const nameMatch = text.match(/בית הכנסת\s*\n([^\n]+)/);
    if (nameMatch) name = nameMatch[1].trim();

    // Extract address
    let address = null;
    const addrMatch = text.match(/כתובת בית הכנסת\s*\n([^\n]+)/);
    if (addrMatch) address = addrMatch[1].trim();

    // Extract nusach/denomination
    let denomination = null;
    const nusachMatch = text.match(/נוסח\s*\n([^\n]+)/);
    if (nusachMatch) denomination = nusachMatch[1].trim();

    // Extract website
    let website = null;
    const websiteMatch = text.match(/קישור\s*\n([^\n]+)/);
    if (websiteMatch) website = websiteMatch[1].trim();

    // Extract prayer times / notes (description)
    let description = null;
    const prayerMatch = text.match(/זמני תפילה[\s\S]*?\n([\s\S]+?)(?:\nזמן עדכון|$)/);
    if (prayerMatch) {
      const desc = prayerMatch[1].trim();
      if (desc && desc.length > 2) description = desc;
    }

    if (name || address) {
      // Add city suffix to address
      if (address && !address.includes(CITY)) address = `${address}, ${CITY}`;
      if (!address) address = CITY;

      const entry = { name: name || cardText.split('\n')[0].trim(), address, destinationId: DEST_ID };
      if (denomination) entry.denomination = denomination;
      if (website) entry.website = website;
      if (description) entry.description = description;

      console.log(`  ✓ ${entry.name} | ${entry.address} | ${denomination || ''}`);
      results.push(entry);
    } else {
      console.log(`  ✗ Could not parse details`);
    }

    // Go back
    await page.goBack();
    await page.waitForTimeout(2000);
  }

  await browser.close();

  console.log(`\n=== Total: ${results.length} synagogues ===`);
  results.forEach(s => console.log(`  ${s.name} | ${s.address}`));

  fs.writeFileSync(
    path.join(__dirname, '..', 'import-maale-adumim-synagogues.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('\nSaved to import-maale-adumim-synagogues.json');
})();
