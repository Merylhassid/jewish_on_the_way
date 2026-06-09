/**
 * Scraper for totallyjewishtravel.com — Miami kosher restaurants
 * AngularJS-rendered, needs Playwright. Handles pagination.
 *
 * Usage:  npx ts-node scripts/scrape-tjt-miami.ts
 * Output: backend/scraped/tjt-miami.json
 */
import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const DEST_ID = 464; // Miami
const URL = 'https://www.totallyjewishtravel.com/kosherrestaurants-TJ3183-Miami_Florida-Kosher_Eateries.html';
const OUT = path.join(__dirname, '../scraped/tjt-miami.json');

function mapKashrut(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('chabad') || t.includes('lubavitch') || t.includes('loubavitch') || t.includes('mehadrin')) return 'mehadrin';
  if (t.includes('badatz')) return 'badatz';
  return 'rabbinate';
}

function mapType(foodType: string): string | null {
  const t = foodType.toLowerCase();
  if (t.includes('meat') || t.includes('glatt') || t.includes('fleish')) return 'meat';
  if (t.includes('dairy') || t.includes('milk') || t.includes('chalav') || t.includes('parve')) return 'dairy';
  if (t === 'parve' || t === 'pareve') return 'pareve';
  return null;
}

async function extractPage(page: Page): Promise<any[]> {
  return page.evaluate((destId: number) => {
    function mapKashrutInner(text: string): string {
      const t = text.toLowerCase();
      if (t.includes('chabad') || t.includes('lubavitch') || t.includes('mehadrin')) return 'mehadrin';
      if (t.includes('badatz')) return 'badatz';
      return 'rabbinate';
    }
    function mapTypeInner(foodType: string): string | null {
      const t = foodType.toLowerCase();
      if (t.includes('meat') || t.includes('glatt') || t.includes('fleish')) return 'meat';
      if (t.includes('dairy') || t.includes('milk') || t.includes('parve')) return 'dairy';
      if (t === 'parve' || t === 'pareve') return 'pareve';
      return null;
    }

    const results: any[] = [];
    const cards = document.querySelectorAll('.commercial-result-list');

    for (const card of Array.from(cards)) {
      // Name
      const nameEl = card.querySelector('h2 a');
      const name = nameEl?.textContent?.trim().replace(/^‎/, '') || '';
      if (!name) continue;

      // Address — find the <p> containing "Address:"
      let address = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Address:')) {
          address = p.textContent.replace('Address:', '').trim();
        }
      });
      if (!address) address = 'Miami, FL';
      if (!address.toLowerCase().includes('miami')) address += ', Miami, FL';

      // Phone
      let phone = '';
      const telEl = card.querySelector('a.tel');
      if (telEl) phone = (telEl.textContent?.trim().replace(/^‎/, '') || '').replace(/\s+/g, '');

      // Supervision / kashrut
      let kashrutText = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Supervision:')) {
          const btns = p.querySelectorAll('a.sm-btn');
          kashrutText = Array.from(btns).map(b => b.textContent?.trim()).join(', ');
        }
      });

      // Food type
      let foodTypeText = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Food Type:')) {
          const btns = p.querySelectorAll('a.sm-btn');
          foodTypeText = Array.from(btns).map(b => b.textContent?.trim()).join(', ');
        }
      });

      // Coordinates from Google Maps Directions link
      let lat: number | null = null;
      let lng: number | null = null;
      const mapsLink = card.querySelector('a[href*="maps.google.com?daddr"]') as HTMLAnchorElement | null;
      if (mapsLink) {
        const m = mapsLink.href.match(/daddr=([-\d.]+),([-\d.]+)/);
        if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
      }

      results.push({
        name,
        address,
        city: 'Miami',
        country: 'United States',
        phone: phone.slice(0, 32) || null,
        kashrut_level: mapKashrutInner(kashrutText),
        restaurant_type: mapTypeInner(foodTypeText),
        is_kosher: true,
        opening_hours: null,
        website_url: null,
        lat,
        lng,
        destinationId: destId,
        source_url: window.location.href,
      });
    }
    return results;
  }, DEST_ID);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('Loading Miami page...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const allRestaurants: any[] = [];
  const seenNames = new Set<string>();
  let pageNum = 1;

  while (true) {
    console.log(`  Extracting page ${pageNum}...`);
    const batch = await extractPage(page);
    let newOnes = 0;
    for (const r of batch) {
      const key = r.name.toLowerCase().trim();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        allRestaurants.push(r);
        newOnes++;
      }
    }
    console.log(`    ${newOnes} new restaurants (total so far: ${allRestaurants.length})`);
    if (newOnes === 0) break;

    // Try to click the next-page button
    const nextBtn = await page.$('a[ng-click*="nextPage"], .pagination .next a, li.next a, a:has-text("›"), a:has-text("Next")');
    if (!nextBtn) break;
    const isDisabled = await nextBtn.evaluate(el => el.classList.contains('disabled') || (el as HTMLElement).style.pointerEvents === 'none');
    if (isDisabled) break;

    console.log(`  Going to page ${pageNum + 1}...`);
    await nextBtn.click();
    await page.waitForTimeout(1500);
    pageNum++;
  }

  await browser.close();

  // Sort by name
  allRestaurants.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUT, JSON.stringify(allRestaurants, null, 2), 'utf-8');
  console.log(`\n✅ ${allRestaurants.length} restaurants saved to ${OUT}`);
  allRestaurants.forEach(r => console.log(`  • ${r.name} — ${r.address}`));
}

main().catch(console.error);
