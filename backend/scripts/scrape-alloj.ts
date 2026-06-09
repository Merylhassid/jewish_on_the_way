/**
 * Scraper for alloj.com — multi-city kosher restaurants
 * Uses axios + cheerio (content is server-side rendered)
 *
 * Usage:  npx ts-node scripts/scrape-alloj.ts
 * Output: backend/scraped/alloj-all.json
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://www.alloj.com';
const DELAY_MS = 1200;

const CITIES: { name: string; country: string; destId: number; url: string }[] = [
  { name: 'Paris',     country: 'France',   destId: 294, url: `${BASE}/fr/les-restaurants-cacher-paris.html` },
  { name: 'Nice',      country: 'France',   destId: 353, url: `${BASE}/fr/restaurant-cacher-nice.html` },
  { name: 'Cannes',    country: 'France',   destId: 325, url: `${BASE}/fr/restaurant-cacher-cannes.html` },
  { name: 'Marrakech', country: 'Morocco',  destId: 375, url: `${BASE}/fr/restaurant-cacher-marrakech.html` },
  { name: 'Dubai',     country: 'UAE',      destId: 340, url: `${BASE}/fr/restaurant-cacher-dubai.html` },
  { name: 'Porto',     country: 'Portugal', destId: 297, url: `${BASE}/fr/restaurant-cacher-porto.html` },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function mapKashrut(hrefOrText: string): string {
  const t = hrefOrText.toLowerCase();
  if (t.includes('loubavitch') || t.includes('lubavitch') || t.includes('chabad') || t.includes('pevzner')) return 'mehadrin';
  if (t.includes('badatz') || t.includes('edah')) return 'badatz';
  return 'rabbinate';
}

function mapType(href: string): string | null {
  if (href.includes('restaurant-cacher-viande') || href.includes('restaurant-cacher-bassari')) return 'meat';
  if (href.includes('restaurant-cacher-lait') || href.includes('restaurant-cacher-halavi')) return 'dairy';
  return null;
}

function extractPhone(onclick: string): string {
  const m = onclick.match(/tel:([\d\s+\-().]+)/);
  return m ? m[1].replace(/\s+/g, '').trim() : '';
}

function parseCards(html: string, city: typeof CITIES[0]): any[] {
  const $ = cheerio.load(html);
  const results: any[] = [];
  const seen = new Set<string>();

  $('.card-container').each((_, cardEl) => {
    const card = $(cardEl);
    const content = card.find('.card-content');

    // Must have a restaurant detail link in the title
    const titleLink = content.find('.title-line h3 a[href*="/restaurant-cacher/"]').first();
    if (!titleLink.length) return;

    const href = titleLink.attr('href') || '';
    // Skip carte.html and #contact links
    if (href.includes('/carte.html') || href.includes('#')) return;
    const fullUrl = href.startsWith('http') ? href : `${BASE}${href}`;
    if (seen.has(fullUrl)) return;
    seen.add(fullUrl);

    const name = titleLink.text().trim();
    if (!name || name.length < 2) return;

    // Address: combine street + city from info-badge span links
    const infoSpan = content.find('.info-line .info-badge span');
    const addrParts = infoSpan.find('a').map((_, a) => $(a).text().trim()).get().filter(t => t.length > 0);
    let address = addrParts.join(' ').trim();
    if (!address) {
      // fallback: full info-line text, strip icon names
      address = content.find('.info-line').text()
        .replace(/location_on/g, '').replace(/\s+/g, ' ').trim();
    }
    if (!address) address = city.name;
    if (!address.toLowerCase().includes(city.name.toLowerCase())) {
      address = `${address}, ${city.name}`;
    }

    // Kashrut: from first verification badge (a href with kashrut authority)
    let kashrutLevel = 'rabbinate';
    card.find('.badges-container a').each((_, a) => {
      const aHref = $(a).attr('href') || '';
      if (aHref.includes('restaurant-cacher-') &&
          !aHref.includes('restaurant-cacher-viande') &&
          !aHref.includes('restaurant-cacher-lait')) {
        kashrutLevel = mapKashrut(aHref);
        return false; // break
      }
    });

    // Type: from type badge link href
    let restaurantType: string | null = null;
    card.find('.badges-container a').each((_, a) => {
      const aHref = $(a).attr('href') || '';
      const t = mapType(aHref);
      if (t) { restaurantType = t; return false; }
    });

    // Phone: from phone-btn onclick
    let phone = '';
    const phoneBtn = card.find('button.phone-btn');
    if (phoneBtn.length) {
      phone = extractPhone(phoneBtn.attr('onclick') || '').slice(0, 32);
    }

    // Website: external links (not alloj, not google maps, not social)
    let website = '';
    card.find('a[href^="http"]').each((_, a) => {
      const h = $(a).attr('href') || '';
      if (!h.includes('alloj.com') && !h.includes('maps.google') &&
          !h.includes('facebook') && !h.includes('instagram') &&
          !h.includes('whatsapp') && !website) {
        website = h;
      }
    });

    results.push({
      name,
      address,
      city: city.name,
      country: city.country,
      phone: phone || null,
      kashrut_level: kashrutLevel,
      restaurant_type: restaurantType,
      is_kosher: true,
      opening_hours: null,
      website_url: website || null,
      lat: null,
      lng: null,
      destinationId: city.destId,
      source_url: fullUrl,
    });
  });

  return results;
}

/** For paginated pages (Paris), check how many pages there are via AJAX or extra pages */
async function fetchAllPages(city: typeof CITIES[0]): Promise<string> {
  const res = await axios.get(city.url, { headers: HEADERS, timeout: 25000 });
  let html: string = res.data;

  // Check for pagination: next page links or AJAX offset param
  const $ = cheerio.load(html);
  // Try to find AJAX load-more data (e.g. data-page, data-offset attributes)
  const loadMore = $('[data-page], [data-offset], .more_results, a:contains("Plus de"), a:contains("Voir plus")');
  if (loadMore.length > 0) {
    console.log(`  Pagination detected for ${city.name} — fetching extra pages via numbered URL...`);
    // Try page 2, 3, etc. using standard pagination path
    let page = 2;
    while (page <= 20) {
      const pageUrl = `${city.url.replace('.html', '')}/page/${page}.html`;
      try {
        const pr = await axios.get(pageUrl, { headers: HEADERS, timeout: 20000 });
        const $p = cheerio.load(pr.data as string);
        const hasCards = $p('.card-container').filter((_, el) => $p(el).find('a[href*="/restaurant-cacher/"]').length > 0).length;
        if (hasCards === 0) break;
        console.log(`    Page ${page}: ${hasCards} cards`);
        html += pr.data;
        page++;
        await sleep(DELAY_MS);
      } catch {
        break;
      }
    }
  }

  return html;
}

async function scrapeCity(city: typeof CITIES[0]): Promise<any[]> {
  console.log(`\n=== ${city.name} ===`);
  try {
    const html = await fetchAllPages(city);
    const restaurants = parseCards(html, city);
    console.log(`  ✓ ${restaurants.length} restaurants`);
    restaurants.forEach(r => console.log(`    • ${r.name} — ${r.address}`));
    return restaurants;
  } catch (e: any) {
    console.warn(`  ✗ Error: ${e.message}`);
    return [];
  }
}

async function main() {
  const all: any[] = [];

  for (const city of CITIES) {
    const results = await scrapeCity(city);
    all.push(...results);
    await sleep(DELAY_MS);
  }

  const outPath = path.join(__dirname, '../scraped/alloj-all.json');
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`\n✅ Total: ${all.length} restaurants → ${outPath}`);
  const byCity: Record<string, number> = {};
  for (const r of all) byCity[r.city] = (byCity[r.city] || 0) + 1;
  Object.entries(byCity).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main().catch(console.error);
