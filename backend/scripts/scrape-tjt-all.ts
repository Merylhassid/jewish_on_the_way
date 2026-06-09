/**
 * Comprehensive TJT scraper — all international destinations in the DB
 * Scrapes totallyjewishtravel.com for each city, skips duplicates on import.
 *
 * Usage:  npx ts-node scripts/scrape-tjt-all.ts
 * Output: backend/scraped/tjt-all.json  (append mode per city)
 */
import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://www.totallyjewishtravel.com/kosherrestaurants-';

// Cities already fully scraped from TJT — skip to save time
const ALREADY_DONE = new Set([3183, 3370, 2919, 3732, 4611]); // Miami, Chicago, LA, LasVegas, Dallas

const CITIES: { name: string; country: string; destId: number; tjId: number; citySlug: string }[] = [
  // United States
  { name: 'New York',    country: 'United States', destId: 463, tjId: 4080, citySlug: 'New_York_City_New_York' },
  // Canada
  { name: 'Montreal',   country: 'Canada',         destId: 479, tjId: 4821, citySlug: 'Montreal_Quebec' },
  // Argentina
  { name: 'Buenos Aires', country: 'Argentina',    destId: 478, tjId: 5232, citySlug: 'Buenos_Aires_City_Argentina' },
  // UK
  { name: 'London',     country: 'United Kingdom', destId: 333, tjId: 6946, citySlug: 'London_United_Kingdom_UK' },
  // France
  { name: 'Paris',      country: 'France',         destId: 294, tjId: 2511, citySlug: 'Paris_France' },
  { name: 'Nice',       country: 'France',         destId: 353, tjId: 2523, citySlug: 'Nice_France' },
  { name: 'Cannes',     country: 'France',         destId: 325, tjId: 2520, citySlug: 'Cannes_France' },
  // Germany
  { name: 'Berlin',     country: 'Germany',        destId: 483, tjId: 1257, citySlug: 'Berlin_Germany' },
  // Austria
  { name: 'Vienna',     country: 'Austria',        destId: 484, tjId: 807,  citySlug: 'Vienna_Austria' },
  // Netherlands
  { name: 'Amsterdam',  country: 'Netherlands',    destId: 482, tjId: 1342, citySlug: 'Amsterdam_The_Netherlands' },
  // Hungary
  { name: 'Budapest',   country: 'Hungary',        destId: 481, tjId: 1369, citySlug: 'Budapest_Hungary' },
  // Italy
  { name: 'Rome',       country: 'Italy',          destId: 373, tjId: 920,  citySlug: 'Rome_Italy' },
  // Czech Republic
  { name: 'Prague',     country: 'Czech Republic', destId: 323, tjId: 2499, citySlug: 'Prague_Czech_Republic' },
  // Spain
  { name: 'Barcelona',  country: 'Spain',          destId: 356, tjId: 2423, citySlug: 'Barcelona_Spain' },
  // Portugal
  { name: 'Porto',      country: 'Portugal',       destId: 297, tjId: 7617, citySlug: 'Porto_Portugal' },
  // Ireland
  { name: 'Dublin',     country: 'Ireland',        destId: 307, tjId: 983,  citySlug: 'Dublin_Ireland' },
  // Thailand
  { name: 'Bangkok',    country: 'Thailand',       destId: 470, tjId: 1398, citySlug: 'Bangkok_Thailand' },
  { name: 'Chiang Mai', country: 'Thailand',       destId: 473, tjId: 1401, citySlug: 'Chiang_Mai_Thailand' },
  { name: 'Ko Samui',   country: 'Thailand',       destId: 472, tjId: 1404, citySlug: 'Koh_Samui_Thailand' },
  { name: 'Koh Phangan',country: 'Thailand',       destId: 476, tjId: 1406, citySlug: 'Koh_Phangan_Thailand' },
  { name: 'Phuket',     country: 'Thailand',       destId: 471, tjId: 7696, citySlug: 'Phuket_Island_Thailand' },
  { name: 'Pai',        country: 'Thailand',       destId: 477, tjId: 7700, citySlug: 'Pai_Thailand' },
  // Cyprus
  { name: 'Larnaca',    country: 'Cyprus',         destId: 363, tjId: 2732, citySlug: 'Larnaca_Cyprus' },
  { name: 'Limassol',   country: 'Cyprus',         destId: 315, tjId: 7735, citySlug: 'Limassol_Cyprus' },
  { name: 'Paphos',     country: 'Cyprus',         destId: 316, tjId: 7767, citySlug: 'Paphos_Cyprus' },
  // Morocco
  { name: 'Marrakech',  country: 'Morocco',        destId: 375, tjId: 2325, citySlug: 'Marrakech_Morocco' },
  // UAE
  { name: 'Dubai',      country: 'UAE',            destId: 340, tjId: 6438, citySlug: 'Dubai_United_Arab_Emirates' },
];

const OUT = path.join(__dirname, '../scraped/tjt-all.json');

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
  return null;
}

async function extractPage(page: Page, destId: number, cityName: string): Promise<any[]> {
  return page.evaluate(({ destId, cityName }) => {
    function mk(t: string): string {
      const s = t.toLowerCase();
      if (s.includes('chabad') || s.includes('lubavitch') || s.includes('mehadrin')) return 'mehadrin';
      if (s.includes('badatz')) return 'badatz';
      return 'rabbinate';
    }
    function mt(ft: string): string | null {
      const s = ft.toLowerCase();
      if (s.includes('meat') || s.includes('glatt')) return 'meat';
      if (s.includes('dairy') || s.includes('milk') || s.includes('parve')) return 'dairy';
      return null;
    }
    const results: any[] = [];
    document.querySelectorAll('.commercial-result-list').forEach(card => {
      const nameEl = card.querySelector('h2 a');
      const name = nameEl?.textContent?.trim().replace(/^‎/, '') || '';
      if (!name) return;

      let address = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Address:')) address = p.textContent.replace('Address:', '').trim();
      });
      if (!address) address = cityName;

      let phone = '';
      const tel = card.querySelector('a.tel');
      if (tel) phone = (tel.textContent?.trim().replace(/^‎/, '') || '').replace(/\s+/g, '');

      let kashrutText = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Supervision:'))
          kashrutText = Array.from(p.querySelectorAll('a.sm-btn')).map(b => b.textContent?.trim()).join(', ');
      });

      let foodTypeText = '';
      card.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Food Type:'))
          foodTypeText = Array.from(p.querySelectorAll('a.sm-btn')).map(b => b.textContent?.trim()).join(', ');
      });

      let lat: number | null = null, lng: number | null = null;
      const mLink = card.querySelector('a[href*="maps.google.com?daddr"]') as HTMLAnchorElement | null;
      if (mLink) {
        const m = mLink.href.match(/daddr=([-\d.]+),([-\d.]+)/);
        if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
      }

      results.push({
        name, address, city: cityName, country: '',
        phone: phone.slice(0, 32) || null,
        kashrut_level: mk(kashrutText),
        restaurant_type: mt(foodTypeText),
        is_kosher: true, opening_hours: null, website_url: null,
        lat, lng, destinationId: destId,
        source_url: window.location.href,
      });
    });
    return results;
  }, { destId, cityName });
}

async function scrapeCity(page: Page, city: typeof CITIES[0]): Promise<any[]> {
  if (ALREADY_DONE.has(city.tjId)) {
    console.log(`  ${city.name}: skipped (already done)`);
    return [];
  }
  const url = `${BASE}TJ${city.tjId}-${city.citySlug}-Kosher_Eateries.html`;
  console.log(`\n=== ${city.name} (TJ${city.tjId}) ===`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
  } catch {
    console.log(`  ✗ Failed to load`);
    return [];
  }

  const all: any[] = [];
  const seen = new Set<string>();
  let pageNum = 1;

  while (true) {
    const batch = await extractPage(page, city.destId, city.name);
    let newCount = 0;
    for (const r of batch) {
      r.country = city.country;
      const key = r.name.toLowerCase().trim();
      if (!seen.has(key)) { seen.add(key); all.push(r); newCount++; }
    }
    if (newCount === 0) break;
    pageNum++;

    const nextBtn = await page.$('a[ng-click*="page + 1"]:not(.inactive), a:has-text("next"):not(.inactive)');
    if (!nextBtn) break;
    const disabled = await nextBtn.evaluate(el => el.classList.contains('inactive') || el.classList.contains('disabled'));
    if (disabled) break;
    await nextBtn.click();
    await page.waitForTimeout(1500);
  }

  // Filter shops and non-restaurants
  const filtered = all.filter(r =>
    !r.name.startsWith('Shop:') &&
    !/^(Shabbat Dinner|Shabbat Meals|Catering:)/i.test(r.name)
  );
  console.log(`  ✓ ${filtered.length} restaurants (${all.length - filtered.length} filtered)`);
  filtered.forEach(r => console.log(`    • ${r.name}`));
  return filtered;
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
  const allResults: any[] = [];

  for (const city of CITIES) {
    const results = await scrapeCity(page, city);
    allResults.push(...results);
    if (results.length > 0) await page.waitForTimeout(800);
  }

  await browser.close();

  fs.writeFileSync(OUT, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\n✅ Total scraped: ${allResults.length} restaurants`);
  const byCity: Record<string, number> = {};
  allResults.forEach(r => byCity[r.city] = (byCity[r.city] || 0) + 1);
  Object.entries(byCity).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main().catch(console.error);
