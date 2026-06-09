/**
 * Scraper for globuskasher.com restaurants
 * Cloudflare-aware: opens a visible browser, lets you pass the challenge manually,
 * then auto-scrapes all cities.
 *
 * Usage:
 *   npx ts-node scripts/scrape-globus.ts
 *
 * Output:
 *   backend/scraped/globus-all-cities.json
 */
import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ── City → destinationId mapping ──────────────────────────────────────────────
// Fill these in once we know the DB destination IDs for each city.
// Run: SELECT id, name FROM destinations WHERE name IN (...) to get them.
const CITY_TO_DEST: Record<string, number> = {
  'Bangkok':      0,   // TODO
  'Barcelona':    0,   // TODO
  'Cannes':       0,   // TODO
  'Chiang Mai':   0,   // TODO
  'Chicago':      0,   // TODO
  'Dallas':       0,   // TODO
  'Dubai':        0,   // TODO
  'Dublin':       0,   // TODO
  'Ko Samui':     0,   // TODO
  'Koh Phangan':  0,   // TODO
  'Larnaca':      0,   // TODO
  'Las Vegas':    0,   // TODO
  'Limassol':     0,   // TODO
  'Los Angeles':  0,   // TODO
  'Marrakech':    0,   // TODO
  'Miami':        0,   // TODO
  'Nice':         0,   // TODO
  'Pai':          0,   // TODO
  'Paphos':       0,   // TODO
  'Phuket':       0,   // TODO
  'Porto':        0,   // TODO
  'Prague':       0,   // TODO
  'Rome':         0,   // TODO
};

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function scrapeRestaurantPage(page: Page, url: string, cityName: string): Promise<any[]> {
  console.log(`  Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Check if Cloudflare block is still showing
  const bodyText = await page.$eval('body', (el) => el.innerText?.slice(0, 200)).catch(() => '');
  if (bodyText.includes('Cloudflare') || bodyText.includes('אימות אבטחה')) {
    console.log('  ⚠️  Cloudflare block detected — waiting for manual solve...');
    await waitForEnter('  Press Enter after passing the Cloudflare challenge: ');
    await page.waitForTimeout(2000);
  }

  // Print raw page text to help understand structure
  const pageText = await page.$eval('body', (el) => el.innerText).catch(() => '');
  console.log('\n--- PAGE TEXT PREVIEW ---');
  console.log(pageText.slice(0, 3000));
  console.log('--- END PREVIEW ---\n');

  // Print all links on the page
  const links = await page.$$eval('a[href]', (els) =>
    els.map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() }))
       .filter((l) => l.href.includes('globuskasher') && l.text && l.text.length > 1)
  ).catch(() => []);
  console.log('Internal links found:', JSON.stringify(links.slice(0, 30), null, 2));

  // Try common WordPress/restaurant selectors
  const restaurants: any[] = [];

  // Try to find restaurant entries
  const entries = await page.$$eval(
    'article, .restaurant-item, .post, .elementor-post, [class*="restaurant"], [class*="listing"]',
    (els) => els.slice(0, 100).map((el) => ({
      text: (el as HTMLElement).innerText?.slice(0, 500),
      html: (el as HTMLElement).innerHTML?.slice(0, 500),
      classes: (el as HTMLElement).className,
    }))
  ).catch(() => []);

  console.log(`\nFound ${entries.length} potential entries`);
  if (entries.length > 0) {
    console.log('First entry sample:', JSON.stringify(entries[0], null, 2));
  }

  return restaurants;
}

async function main() {
  console.log('Opening browser — please solve Cloudflare on the main page, then press Enter.');

  // Connect to your already-open Chrome (must be launched with --remote-debugging-port=9222)
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  console.log('Connected to your Chrome browser.');
  await waitForEnter('\nMake sure you are on globuskasher.com and past Cloudflare, then press Enter: ');

  // Now explore a couple of city pages to understand structure
  await scrapeRestaurantPage(page, 'https://globuskasher.com/%D7%9E%D7%A1%D7%A2%D7%93%D7%95%D7%AA/', 'main');

  console.log('\nNow trying a city page — Barcelona:');
  // Try possible URL patterns
  const patterns = [
    'https://globuskasher.com/barcelona/',
    'https://globuskasher.com/?s=barcelona',
    'https://globuskasher.com/category/barcelona/',
  ];
  for (const url of patterns) {
    await scrapeRestaurantPage(page, url, 'Barcelona');
  }

  await browser.close();
}

main().catch(console.error);
