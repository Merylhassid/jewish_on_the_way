/**
 * Scraper for totallyjewishtravel.com — multi-city US kosher restaurants
 * Reuses the same AngularJS extraction logic as scrape-tjt-miami.ts
 *
 * Usage:  npx ts-node scripts/scrape-tjt-cities.ts
 * Output: backend/scraped/tjt-cities.json
 */
import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const CITIES: { name: string; country: string; destId: number; url: string }[] = [
  {
    name: 'Chicago', country: 'United States', destId: 466,
    url: 'https://www.totallyjewishtravel.com/kosherrestaurants-TJ3370-Chicago_Illinois-Kosher_Eateries.html',
  },
  {
    name: 'Los Angeles', country: 'United States', destId: 465,
    url: 'https://www.totallyjewishtravel.com/kosherrestaurants-TJ2919-Los_Angeles_California-Kosher_Eateries.html',
  },
  {
    name: 'Las Vegas', country: 'United States', destId: 468,
    url: 'https://www.totallyjewishtravel.com/kosherrestaurants-TJ3732-Las_Vegas_Nevada-Kosher_Eateries.html',
  },
  {
    name: 'Dallas', country: 'United States', destId: 467,
    url: 'https://www.totallyjewishtravel.com/kosherrestaurants-TJ4611-Dallas_Texas-Kosher_Eateries.html',
  },
];

const OUT = path.join(__dirname, '../scraped/tjt-cities.json');

async function extractPage(page: Page, destId: number, cityName: string): Promise<any[]> {
  return page.evaluate(({ destId, cityName }) => {
    function mapKashrut(text: string): string {
      const t = text.toLowerCase();
      if (t.includes('chabad') || t.includes('lubavitch') || t.includes('mehadrin')) return 'mehadrin';
      if (t.includes('badatz')) return 'badatz';
      return 'rabbinate';
    }
    function mapType(foodType: string): string | null {
      const t = foodType.toLowerCase();
      if (t.includes('meat') || t.includes('glatt') || t.includes('fleish')) return 'meat';
      if (t.includes('dairy') || t.includes('milk') || t.includes('parve')) return 'dairy';
      if (t === 'parve' || t === 'pareve') return 'pareve';
      return null;
    }

    const results: any[] = [];
    const cards = document.querySelectorAll('.commercial-result-list');
    for (const card of Array.from(cards)) {
      const nameEl = card.querySelector('h2 a');
      const name = nameEl?.textContent?.trim().replace(/^‎/, '') || '';
      if (!name) continue;

      let address = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Address:')) {
          address = p.textContent.replace('Address:', '').trim();
        }
      });
      if (!address) address = cityName;

      let phone = '';
      const telEl = card.querySelector('a.tel');
      if (telEl) phone = (telEl.textContent?.trim().replace(/^‎/, '') || '').replace(/\s+/g, '');

      let kashrutText = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Supervision:')) {
          kashrutText = Array.from(p.querySelectorAll('a.sm-btn')).map(b => b.textContent?.trim()).join(', ');
        }
      });

      let foodTypeText = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Food Type:')) {
          foodTypeText = Array.from(p.querySelectorAll('a.sm-btn')).map(b => b.textContent?.trim()).join(', ');
        }
      });

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
        city: cityName,
        country: 'United States',
        phone: phone.slice(0, 32) || null,
        kashrut_level: mapKashrut(kashrutText),
        restaurant_type: mapType(foodTypeText),
        is_kosher: true,
        opening_hours: null,
        website_url: null,
        lat, lng,
        destinationId: destId,
        source_url: window.location.href,
      });
    }
    return results;
  }, { destId, cityName });
}

async function scrapeCity(page: Page, city: typeof CITIES[0]): Promise<any[]> {
  console.log(`\n=== ${city.name} ===`);
  await page.goto(city.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const all: any[] = [];
  const seen = new Set<string>();
  let pageNum = 1;

  while (true) {
    const batch = await extractPage(page, city.destId, city.name);
    let newCount = 0;
    for (const r of batch) {
      const key = r.name.toLowerCase().trim();
      if (!seen.has(key)) { seen.add(key); all.push(r); newCount++; }
    }
    console.log(`  Page ${pageNum}: ${newCount} new (total ${all.length})`);
    if (newCount === 0) break;

    const nextBtn = await page.$('a[ng-click*="page + 1"]:not(.inactive), a.pag-nav.pull-right:not(.inactive)');
    if (!nextBtn) break;
    const disabled = await nextBtn.evaluate(el => el.classList.contains('inactive') || el.classList.contains('disabled'));
    if (disabled) break;
    await nextBtn.click();
    await page.waitForTimeout(1500);
    pageNum++;
  }

  return all;
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
  const all: any[] = [];

  for (const city of CITIES) {
    const results = await scrapeCity(page, city);
    // Filter out shops and catering-only
    const filtered = results.filter(r => !r.name.startsWith('Shop:') && !/^(Shabbat Dinner|Shabbat Meals)/i.test(r.name));
    all.push(...filtered);
    console.log(`  -> ${filtered.length} restaurants for ${city.name}`);
  }

  await browser.close();

  fs.writeFileSync(OUT, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`\n✅ Total: ${all.length} restaurants saved to ${OUT}`);
  const byCity: Record<string, number> = {};
  all.forEach(r => byCity[r.city] = (byCity[r.city] || 0) + 1);
  Object.entries(byCity).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main().catch(console.error);
