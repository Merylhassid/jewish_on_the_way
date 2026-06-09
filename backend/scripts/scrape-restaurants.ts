/**
 * Scraper for metaylimbkipa.com kosher restaurant pages
 *
 * Usage — single city page:
 *   npx ts-node -r tsconfig-paths/register scripts/scrape-restaurants.ts \
 *     "https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-budapest/"
 *
 * Usage — all city pages at once:
 *   npx ts-node -r tsconfig-paths/register scripts/scrape-restaurants.ts --all
 *
 * Outputs (in backend/scraped/):
 *   budapest.json / budapest.csv
 *   all-cities.json / all-cities.csv
 *   progress.json  ← resume checkpoint
 */

import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ─── City pages to scrape when using --all ────────────────────────────────────
const CITY_PAGES: Array<{ city: string; country: string; url: string }> = [
  { city: 'Budapest', country: 'Hungary', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-budapest/' },
  { city: 'Paris', country: 'France', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-paris/' },
  { city: 'London', country: 'UK', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-london/' },
  { city: 'New York', country: 'USA', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-new-york/' },
  { city: 'Amsterdam', country: 'Netherlands', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-amsterdam/' },
  { city: 'Berlin', country: 'Germany', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-berlin/' },
  { city: 'Prague', country: 'Czech Republic', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-prague/' },
  { city: 'Rome', country: 'Italy', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-rome/' },
  { city: 'Barcelona', country: 'Spain', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-barcelona/' },
  { city: 'Vienna', country: 'Austria', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-vienna/' },
  { city: 'Miami', country: 'USA', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-miami/' },
  { city: 'Los Angeles', country: 'USA', url: 'https://metaylimbkipa.com/kosher-restaurants-abroad/kosher-restaurants-in-los-angeles/' },
  // Add more cities as needed
];

const OUT_DIR = path.join(__dirname, '../scraped');
const PROGRESS_FILE = path.join(OUT_DIR, 'progress.json');
const DELAY_MIN = 1500;
const DELAY_MAX = 3500;
const RETRY_DELAYS = [3000, 8000, 20000];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedRestaurant {
  name: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  website: string;
  openingHours: string;
  kashrut: string;
  restaurantType: 'meat' | 'dairy' | 'pareve' | 'fish' | 'unknown';
  category: string;
  priceRange: string;
  notes: string;
  sourceUrl: string;
  scrapedAt: string;
}

interface Progress {
  completedUrls: string[];
  lastUpdated: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const randomDelay = () =>
  new Promise((r) => setTimeout(r, DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN)));

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE))
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  return { completedUrls: [], lastUpdated: '' };
}

function saveProgress(p: Progress) {
  p.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function saveJson(results: ScrapedRestaurant[], filePath: string) {
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
}

function saveCsv(results: ScrapedRestaurant[], filePath: string) {
  const headers: (keyof ScrapedRestaurant)[] = [
    'name', 'city', 'country', 'address', 'phone', 'website',
    'openingHours', 'kashrut', 'restaurantType', 'category',
    'priceRange', 'notes', 'sourceUrl', 'scrapedAt',
  ];
  const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...results.map((r) => headers.map((h) => esc(String(r[h] ?? ''))).join(',')),
  ];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

function inferType(typeHints: string): ScrapedRestaurant['restaurantType'] {
  const t = typeHints.toLowerCase();
  if (t.includes('בשר') || t.includes('meat') || t.includes('בשרי')) return 'meat';
  if (t.includes('חלב') || t.includes('dairy') || t.includes('חלבי')) return 'dairy';
  if (t.includes('פרווה') || t.includes('pareve') || t.includes('פרוה')) return 'pareve';
  if (t.includes('דגים') || t.includes('fish') || t.includes(' דג')) return 'fish';
  return 'unknown';
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  for (let i = 0; i <= RETRY_DELAYS.length; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < RETRY_DELAYS.length) {
        console.warn(`  ⚠ ${label} — retry ${i + 1} in ${RETRY_DELAYS[i] / 1000}s`);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[i]));
      } else {
        console.error(`  ✗ ${label} — gave up: ${(err as Error).message}`);
      }
    }
  }
  return null;
}

// ─── Scrape a single city page ────────────────────────────────────────────────

async function scrapeCityPage(
  page: Page,
  url: string,
  city: string,
  country: string,
): Promise<ScrapedRestaurant[]> {
  await withRetry(`load ${url}`, async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });
  await randomDelay();

  // The page organises restaurants under h5 headings inside sections that
  // indicate meat vs dairy.  We walk the DOM collecting all h5 elements,
  // then for each one collect all sibling paragraphs until the next h5.
  const restaurants = await page.evaluate(
    ({ pageUrl, cityName, countryName }) => {
      const results: Array<{
        name: string; city: string; country: string; address: string;
        phone: string; website: string; openingHours: string; kashrut: string;
        typeHint: string; category: string; priceRange: string; notes: string;
        sourceUrl: string; scrapedAt: string;
      }> = [];

      // Extract value after a bolded label inside a paragraph.
      // Works whether the label is in a <strong> or inline text.
      const extractLabel = (container: Element, ...labels: string[]): string => {
        for (const label of labels) {
          // Try <strong> tags first
          for (const strong of Array.from(container.querySelectorAll('strong, b'))) {
            const strongText = strong.textContent?.trim() ?? '';
            if (strongText.includes(label.replace(':', ''))) {
              // Value is the text node(s) after the <strong> inside its parent <p>
              const parent = strong.parentElement;
              if (!parent) continue;
              const full = parent.textContent ?? '';
              const idx = full.indexOf(strongText);
              if (idx !== -1) {
                return full.slice(idx + strongText.length).replace(/^[:\s]+/, '').trim();
              }
            }
          }
          // Fallback: plain text search in full container text
          const fullText = container.textContent ?? '';
          const idx = fullText.indexOf(label);
          if (idx !== -1) {
            const after = fullText.slice(idx + label.length).trim();
            return after.split('\n')[0].trim();
          }
        }
        return '';
      };

      // Get all block-level elements in the content area
      const contentEl =
        document.querySelector('.entry-content, .post-content, article, main') ??
        document.body;

      // Flatten into a list of [tag, element] pairs in DOM order
      const allEls = Array.from(
        contentEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,ol,li,blockquote,div.wp-block-group'),
      );

      let currentSection = ''; // 'dairy' | 'meat' | ''
      let currentName = '';
      let currentContainer: Element | null = null;
      let containerEls: Element[] = [];

      const flush = () => {
        if (!currentName || containerEls.length === 0) return;

        // Build a temporary div with all collected elements so extractLabel can query within
        const tmp = document.createElement('div');
        containerEls.forEach((el) => tmp.appendChild(el.cloneNode(true)));

        const address  = extractLabel(tmp, 'כתובת:', 'כתובת :', 'Address:');
        const phone    = extractLabel(tmp, 'טלפון:', 'טלפון :', 'Phone:', 'Tel:');
        const hours    = extractLabel(tmp, 'שעות פתיחה:', 'שעות פתיחה :', 'Opening hours:');
        const kashrut  = extractLabel(tmp, 'כשרות:', 'כשרות :', 'Kosher:', 'Kashrut:');
        const category = extractLabel(tmp, 'סוג:', 'קטגוריה:', 'Cuisine:');
        const fullText = tmp.textContent ?? '';
        const price    = fullText.match(/€+|\$+/)?.[0] ?? '';

        // Links
        const allLinks = Array.from(tmp.querySelectorAll('a[href]'), (a) => (a as HTMLAnchorElement).href);
        const googleMapsLink = allLinks.find((l) => l.includes('maps.google') || l.includes('goo.gl/maps') || l.includes('maps.app.goo'));
        const websiteLink = allLinks.find(
          (l) => !l.includes('google') && !l.includes('maps') && l.startsWith('http'),
        );

        // Notes: first non-label paragraph
        const notes = Array.from(tmp.querySelectorAll('p'))
          .map((p) => p.textContent?.trim() ?? '')
          .filter(
            (t) =>
              t.length > 15 &&
              !t.includes('כתובת') &&
              !t.includes('טלפון') &&
              !t.includes('שעות') &&
              !t.includes('כשרות') &&
              !t.includes('רמת מחירים'),
          )
          .slice(0, 1)
          .join(' ');

        const typeHint = `${currentSection} ${kashrut} ${currentName}`;

        results.push({
          name: currentName,
          city: cityName,
          country: countryName,
          address: googleMapsLink && !address
            ? `[map: ${googleMapsLink}]`
            : googleMapsLink
              ? `${address} [map: ${googleMapsLink}]`
              : address,
          phone,
          website: websiteLink ?? '',
          openingHours: hours,
          kashrut,
          typeHint,
          category,
          priceRange: price,
          notes,
          sourceUrl: pageUrl,
          scrapedAt: new Date().toISOString(),
        });

        containerEls = [];
        currentContainer = null;
      };

      for (const el of allEls) {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.trim() ?? '';

        // Detect section headings (h2 — dairy / meat separator)
        if (tag === 'h2') {
          const lower = text.toLowerCase();
          if (lower.includes('חלבי') || lower.includes('dairy')) currentSection = 'dairy';
          else if (lower.includes('בשר') || lower.includes('meat')) currentSection = 'meat';
          continue;
        }

        // h3: section heading only if it contains dairy/meat keywords; otherwise restaurant name
        if (tag === 'h3') {
          const lower = text.toLowerCase();
          if (lower.includes('חלבי') || lower.includes('dairy')) { currentSection = 'dairy'; continue; }
          if (lower.includes('בשר') || lower.includes('meat')) { currentSection = 'meat'; continue; }
          if (text.length > 2) {
            flush();
            currentName = text.replace(/^\d+[.)]\s*/, '').trim();
            containerEls = [];
          }
          continue;
        }

        // Restaurant name heading (h4/h5/h6)
        if (['h4', 'h5', 'h6'].includes(tag) && text.length > 2) {
          flush(); // save previous restaurant
          currentName = text.replace(/^\d+[.)]\s*/, '').trim();
          containerEls = [];
          continue;
        }

        // Accumulate content for current restaurant
        if (currentName) {
          containerEls.push(el);
        }
      }

      flush(); // save last restaurant
      return results;
    },
    { pageUrl: url, cityName: city, countryName: country },
  );

  return restaurants
    .map((r) => ({
      ...r,
      // Strip any leftover "Address:" / "כתובת:" prefix the extractor may leave
      address: r.address.replace(/^(Address:|כתובת:)\s*/i, '').trim(),
      phone: r.phone.replace(/^T\s+/, '').trim(),
      restaurantType: inferType(r.typeHint),
      typeHint: undefined as unknown as string,
    }))
    // Only keep entries that are actual restaurants (have address or phone)
    .filter((r) => r.address || r.phone) as ScrapedRestaurant[];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const scrapeAll = args.includes('--all');
  const singleUrl = args.find((a) => a.startsWith('http'));

  const targets: typeof CITY_PAGES = scrapeAll
    ? CITY_PAGES
    : singleUrl
      ? (() => {
          const citySlug = singleUrl.match(/kosher-restaurants-in-([^/]+)/)?.[1] ?? '';
          const cityName = citySlug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
          const known = CITY_PAGES.find((c) => c.url === singleUrl || c.city.toLowerCase() === cityName.toLowerCase());
          return [known ?? { city: cityName || 'Unknown', country: 'Unknown', url: singleUrl }];
        })()
      : [CITY_PAGES[0]]; // default: Budapest

  const progress = loadProgress();
  const done = new Set(progress.completedUrls);
  const allResults: ScrapedRestaurant[] = [];

  console.log(`\n🍽  Metaylim Bkipa scraper`);
  console.log(`   Targets : ${targets.map((t) => t.city).join(', ')}`);
  console.log(`   Already done: ${done.size} pages\n`);

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    locale: 'he-IL',
  });
  const page = await context.newPage();

  for (const target of targets) {
    if (done.has(target.url)) {
      console.log(`  ⏭  ${target.city} — already scraped, skipping`);
      // Load existing results
      const f = path.join(OUT_DIR, `${target.city.toLowerCase().replace(/ /g, '-')}.json`);
      if (fs.existsSync(f)) allResults.push(...JSON.parse(fs.readFileSync(f, 'utf-8')));
      continue;
    }

    console.log(`\n📍 ${target.city}, ${target.country}`);
    const results = await scrapeCityPage(page, target.url, target.city, target.country);
    console.log(`   Found ${results.length} restaurants`);

    if (results.length > 0) {
      allResults.push(...results);
      const slug = target.city.toLowerCase().replace(/ /g, '-');
      saveJson(results, path.join(OUT_DIR, `${slug}.json`));
      saveCsv(results, path.join(OUT_DIR, `${slug}.csv`));
      console.log(`   💾 Saved to scraped/${slug}.json`);
    }

    progress.completedUrls.push(target.url);
    saveProgress(progress);

    await randomDelay();
  }

  await browser.close();

  // Save combined output
  if (allResults.length > 0) {
    saveJson(allResults, path.join(OUT_DIR, 'all-cities.json'));
    saveCsv(allResults, path.join(OUT_DIR, 'all-cities.csv'));
  }

  console.log(`\n✅ Done! ${allResults.length} restaurants total`);
  console.log(`   Output: backend/scraped/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
