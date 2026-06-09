/**
 * Scraper for kosher-traveling.co.il
 * URL pattern: /place/{slug}/food/restaurant/ (paginated)
 * Detail page:  /food/{slug}/{restaurant-slug}/
 *
 * Usage:  npx ts-node scripts/scrape-kosher-traveling.ts
 * Output: backend/scraped/kosher-traveling.json
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://kosher-traveling.co.il';
const DELAY_MS = 1200; // polite delay between requests

const CITIES: { name: string; slug: string; destId: number; country: string }[] = [
  { name: 'Bangkok',    slug: 'bangkok',    destId: 470, country: 'Thailand' },
  { name: 'Barcelona',  slug: 'barcelona',  destId: 356, country: 'Spain' },
  { name: 'Cannes',     slug: 'cannes',     destId: 325, country: 'France' },
  { name: 'Chiang Mai', slug: 'chiang-mai', destId: 473, country: 'Thailand' },
  { name: 'Ko Samui',   slug: 'ko-samui',   destId: 472, country: 'Thailand' },
  { name: 'Larnaca',    slug: 'larnaca',    destId: 363, country: 'Cyprus' },
  { name: 'Limassol',   slug: 'limassol',   destId: 315, country: 'Cyprus' },
  { name: 'Nice',       slug: 'nice',       destId: 353, country: 'France' },
  { name: 'Paphos',     slug: 'paphos',     destId: 316, country: 'Cyprus' },
  { name: 'Phuket',     slug: 'phuket',     destId: 471, country: 'Thailand' },
  { name: 'Prague',     slug: 'prague',     destId: 323, country: 'Czech Republic' },
  { name: 'Rome',       slug: 'rome',       destId: 373, country: 'Italy' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function detectKashrutLevel(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('בד"צ') || t.includes('badatz') || t.includes('עדה החרדית')) return 'badatz';
  if (t.includes('מהדרין') || t.includes('mehadrin')) return 'mehadrin';
  return 'rabbinate';
}

function detectRestaurantType(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('בשרי') || t.includes('meat') || t.includes('בשר')) return 'meat';
  if (t.includes('חלבי') || t.includes('dairy') || t.includes('חלב')) return 'dairy';
  if (t.includes('פרווה') || t.includes('pareve') || t.includes('parve')) return 'pareve';
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
  return res.data as string;
}

/** Extract all restaurant detail-page URLs from one city listing page */
function extractRestaurantLinks(html: string, citySlug: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  const BLOCKED = ['facebook.com', 'twitter.com', 'whatsapp', 'instagram', 'youtube', 'mailto:', 'tel:'];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.includes('/food/')) return;
    if (!href.includes(citySlug)) return;
    if (BLOCKED.some((b) => href.includes(b))) return;
    // Must match pattern /food/{city}/{slug}/ with actual slug (not just /food/{city}/restaurant)
    const match = href.match(/\/food\/[^/]+\/([^/?#]+)\/?$/);
    if (!match || match[1] === 'restaurant') return;
    const full = href.startsWith('http') ? href : BASE + href;
    if (!links.includes(full)) links.push(full);
  });
  return links;
}

/** Get all paginated restaurant links for a city */
async function getCityRestaurantLinks(slug: string): Promise<string[]> {
  const allLinks: string[] = [];
  let page = 1;
  while (true) {
    const url =
      page === 1
        ? `${BASE}/place/${slug}/food/restaurant/`
        : `${BASE}/place/${slug}/food/restaurant/page/${page}/`;
    console.log(`    Fetching listing page ${page}: ${url}`);
    try {
      const html = await fetchHtml(url);
      const links = extractRestaurantLinks(html, slug);
      if (links.length === 0) break;
      allLinks.push(...links.filter((l) => !allLinks.includes(l)));
      // Check if there's a next page
      const $ = cheerio.load(html);
      const hasNext = $('a.next, a[rel="next"], .pagination .next').length > 0
        || html.includes(`/page/${page + 1}/`);
      if (!hasNext) break;
      page++;
      await sleep(DELAY_MS);
    } catch (e: any) {
      if (e.response?.status === 404) break;
      console.warn(`    Error fetching page ${page}: ${e.message}`);
      break;
    }
  }
  return allLinks;
}

/** Scrape a single restaurant detail page */
async function scrapeRestaurant(
  url: string,
  cityName: string,
  country: string,
  destId: number,
): Promise<any | null> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Name — try multiple selectors
    const name =
      $('h1.entry-title, h1.property-title, h1').first().text().trim() ||
      $('title').text().split('|')[0].trim();

    if (!name) return null;

    // Address
    let address = '';
    $('[class*="address"], [itemprop="address"], .property-address, .address').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 5 && !address) address = t;
    });
    // Ensure city name at end of address for geocoding
    if (address && !address.includes(cityName)) {
      address = `${address}, ${cityName}`;
    } else if (!address) {
      address = cityName;
    }

    // Phone
    let phone = '';
    $('a[href^="tel:"]').each((_, el) => {
      if (!phone) phone = ($(el).attr('href') || '').replace('tel:', '').trim();
    });

    // Opening hours
    let openingHours = '';
    $('[class*="hours"], [class*="opening"], [itemprop="openingHours"]').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 3 && !openingHours) openingHours = t.replace(/\s+/g, ' ');
    });

    // Website
    let website = '';
    $('a[href^="http"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.includes('kosher-traveling') && !href.includes('facebook') &&
          !href.includes('instagram') && !website) {
        website = href;
      }
    });

    // Full text for kashrut/type detection
    const bodyText = $('body').text();

    // Try to extract TravelData JS object for lat/lng
    let lat: number | null = null;
    let lng: number | null = null;
    const coordMatch = html.match(/"lat[itude]*"\s*:\s*([-\d.]+).*?"l[no]ng[itude]*"\s*:\s*([-\d.]+)/s)
      || html.match(/lat[itude]*['":\s]+([-\d.]+).*?l[no]ng[itude]*['":\s]+([-\d.]+)/s);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }
    // Also check for TravelData object
    const travelMatch = html.match(/TravelData\s*=\s*(\{[\s\S]*?\});/);
    if (travelMatch && !lat) {
      try {
        const td = JSON.parse(travelMatch[1]);
        lat = td.lat || td.latitude || null;
        lng = td.lng || td.longitude || null;
      } catch {}
    }

    return {
      name,
      address,
      city: cityName,
      country,
      phone: phone.slice(0, 32) || null,
      kashrut_level: detectKashrutLevel(bodyText),
      restaurant_type: detectRestaurantType(bodyText),
      is_kosher: true,
      opening_hours: openingHours || null,
      website_url: website || null,
      lat: lat || null,
      lng: lng || null,
      destinationId: destId,
      source_url: url,
    };
  } catch (e: any) {
    console.warn(`    Error scraping ${url}: ${e.message}`);
    return null;
  }
}

async function main() {
  const allRestaurants: any[] = [];

  for (const city of CITIES) {
    console.log(`\n=== ${city.name} (${city.slug}) ===`);
    const links = await getCityRestaurantLinks(city.slug);
    console.log(`  Found ${links.length} restaurant links`);

    for (let i = 0; i < links.length; i++) {
      const url = links[i];
      process.stdout.write(`  [${i + 1}/${links.length}] ${url.split('/').pop()} ... `);
      const rest = await scrapeRestaurant(url, city.name, city.country, city.destId);
      if (rest) {
        allRestaurants.push(rest);
        process.stdout.write(`✓ ${rest.name}\n`);
      } else {
        process.stdout.write(`✗ skipped\n`);
      }
      await sleep(DELAY_MS);
    }

    console.log(`  Saved ${allRestaurants.filter((r) => r.city === city.name).length} for ${city.name}`);
  }

  const outPath = path.join(__dirname, '../scraped/kosher-traveling.json');
  fs.writeFileSync(outPath, JSON.stringify(allRestaurants, null, 2), 'utf-8');
  console.log(`\n✅ Done! ${allRestaurants.length} restaurants saved to ${outPath}`);

  // Summary per city
  const byCityMap: Record<string, number> = {};
  for (const r of allRestaurants) {
    byCityMap[r.city] = (byCityMap[r.city] || 0) + 1;
  }
  Object.entries(byCityMap).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main().catch(console.error);
