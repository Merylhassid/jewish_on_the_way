/**
 * Scraper for alloj.com — Paris kosher restaurants
 * Uses Playwright because content is loaded dynamically via AJAX
 *
 * Usage:  npx ts-node scripts/scrape-alloj-paris.ts
 * Output: backend/scraped/alloj-paris.json
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const DEST_ID = 294; // Paris
const OUT_PATH = path.join(__dirname, '../scraped/alloj-paris.json');
const URL = 'https://www.alloj.com/fr/les-restaurants-cacher-paris.html';

function mapKashrut(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('loubavitch') || t.includes('loubav') || t.includes('lubavitch')) return 'mehadrin';
  if (t.includes('beth-din') || t.includes('consistoire') || t.includes('grand rabbinat')) return 'rabbinate';
  return 'rabbinate';
}

function mapType(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('viande') || t.includes('meat') || t.includes('בשרי')) return 'meat';
  if (t.includes('halavi') || t.includes('dairy') || t.includes('laitier') || t.includes('fromagerie')) return 'dairy';
  if (t.includes('pareve') || t.includes('poisson') || t.includes('fish')) return 'pareve';
  return null;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  console.log(`Loading ${URL} ...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Click "Plus de Resultats" until it disappears
  let clicks = 0;
  while (true) {
    const btn = await page.$('a.more_results, button.more_results, [class*="more_result"], a:has-text("Plus de"), button:has-text("Plus de")');
    if (!btn) break;
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) break;
    console.log(`  Click #${++clicks} — loading more results...`);
    await btn.click();
    await page.waitForTimeout(2500);
  }
  console.log(`  Done loading — total clicks: ${clicks}`);

  // Extract restaurant entries
  const restaurants = await page.evaluate((destId: number) => {
    function mapKashrut(text: string): string {
      const t = text.toLowerCase();
      if (t.includes('loubavitch') || t.includes('lubavitch')) return 'mehadrin';
      return 'rabbinate';
    }
    function mapType(text: string): string | null {
      const t = text.toLowerCase();
      if (t.includes('viande') || t.includes('meat')) return 'meat';
      if (t.includes('halavi') || t.includes('laitier') || t.includes('dairy') || t.includes('fromage')) return 'dairy';
      if (t.includes('pareve') || t.includes('poisson') || t.includes('fish')) return 'pareve';
      return null;
    }

    const results: any[] = [];
    // Try multiple selectors for restaurant cards
    const selectors = [
      '.restaurant_item', '.resto_item', '.listing-item',
      'article', '.elementor-post', '[class*="restaurant"]',
      '.views-row', '.item-list li', '.field-content',
    ];

    let entries: Element[] = [];
    for (const sel of selectors) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length > 2) { entries = found; break; }
    }

    // Fallback: scan all elements with a name-like heading
    if (entries.length === 0) {
      // Try to get all heading+detail blocks
      entries = Array.from(document.querySelectorAll('h2, h3, .title, .name, [class*="title"], [class*="name"]'))
        .map(el => el.closest('div, article, li') || el)
        .filter((el, i, arr) => arr.indexOf(el) === i);
    }

    for (const el of entries) {
      const html = (el as HTMLElement).innerHTML || '';
      const text = (el as HTMLElement).innerText || '';
      if (!text.trim()) continue;

      // Name: first heading or strong
      const nameEl = el.querySelector('h1, h2, h3, h4, .name, .title, strong');
      const name = nameEl ? (nameEl as HTMLElement).innerText.trim() : text.split('\n')[0].trim();
      if (!name || name.length < 2) continue;

      // Address: look for address-like text
      let address = '';
      const addrEl = el.querySelector('[class*="adress"], [class*="address"], address, .rue, .location');
      if (addrEl) {
        address = (addrEl as HTMLElement).innerText.trim();
      } else {
        // Look for lines with numbers (street addresses)
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (/^\d+/.test(line) || /rue|avenue|bd |boulevard|place |impasse/i.test(line)) {
            address = line;
            break;
          }
        }
      }
      if (!address) address = 'Paris';
      if (!address.toLowerCase().includes('paris')) address += ', Paris';

      // Phone
      let phone = '';
      const telEl = el.querySelector('a[href^="tel:"]');
      if (telEl) phone = ((telEl as HTMLAnchorElement).href || '').replace('tel:', '').trim();

      // Website
      let website = '';
      const linkEls = el.querySelectorAll('a[href^="http"]');
      for (const a of Array.from(linkEls)) {
        const href = (a as HTMLAnchorElement).href;
        if (!href.includes('alloj.com') && !href.includes('facebook') && !href.includes('instagram')) {
          website = href;
          break;
        }
      }

      results.push({
        name,
        address,
        city: 'Paris',
        country: 'France',
        phone: phone.slice(0, 32) || null,
        kashrut_level: mapKashrut(text),
        restaurant_type: mapType(text),
        is_kosher: true,
        opening_hours: null,
        website_url: website || null,
        lat: null,
        lng: null,
        destinationId: destId,
        source_url: window.location.href,
      });
    }
    return results;
  }, DEST_ID);

  console.log(`\nExtracted ${restaurants.length} entries with generic selectors.`);

  // If generic selectors found nothing useful, dump page structure for debug
  if (restaurants.length === 0) {
    console.log('No results found — dumping page structure for debugging...');
    const debugInfo = await page.evaluate(() => {
      const allText = document.body.innerText.slice(0, 4000);
      const links = Array.from(document.querySelectorAll('a'))
        .map(a => ({ href: a.href, text: a.textContent?.trim().slice(0, 50) }))
        .filter(l => l.href.includes('alloj') && l.text && l.text.length > 1)
        .slice(0, 30);
      const classes = Array.from(new Set(
        Array.from(document.querySelectorAll('*'))
          .map(el => el.className)
          .filter(c => typeof c === 'string' && c.length > 0)
          .join(' ').split(/\s+/)
      )).slice(0, 80);
      return { allText, links, classes };
    });
    fs.writeFileSync(
      path.join(__dirname, '../scraped/alloj-debug.json'),
      JSON.stringify(debugInfo, null, 2),
      'utf-8',
    );
    console.log('Debug info saved to backend/scraped/alloj-debug.json');
  }

  await browser.close();

  if (restaurants.length > 0) {
    // Deduplicate by name (case-insensitive)
    const seen = new Set<string>();
    const unique = restaurants.filter(r => {
      const key = r.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    fs.writeFileSync(OUT_PATH, JSON.stringify(unique, null, 2), 'utf-8');
    console.log(`\n✅ Saved ${unique.length} restaurants to ${OUT_PATH}`);
    unique.slice(0, 5).forEach(r => console.log(`  • ${r.name} — ${r.address}`));
  }
}

main().catch(console.error);
