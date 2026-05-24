const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DESTINATION_ID = parseInt(process.argv[2] || '0');

const HEADER_TEXTS = new Set(['כתובת', 'שם הגבאי', 'טלפון', 'טלפון נייד', 'בית הכנסת', 'המועצה הדתית והרבנות נתיבות']);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  console.error('Loading page...');
  await page.goto('https://www.mdnetivot.org/synagogues-3', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const elements = await page.evaluate(() => {
    const all = document.querySelectorAll('[data-testid="richTextElement"], .wixui-horizontal-line, [class*="horizontal-line"]');
    const items = [];
    for (const el of all) {
      if (el.classList.contains('wixui-horizontal-line') || el.className.includes('horizontal-line')) {
        items.push({ type: 'HR' });
      } else {
        const text = el.textContent.trim();
        const links = Array.from(el.querySelectorAll('a[href^="tel:"]')).map(a => a.getAttribute('href').replace('tel:', '').trim());
        if (text) items.push({ type: 'TEXT', text, links });
      }
    }
    return items;
  });

  // Group by HR separators
  const groups = [];
  let current = [];
  for (const el of elements) {
    if (el.type === 'HR') {
      if (current.length > 0) { groups.push(current); current = []; }
    } else {
      current.push(el);
    }
  }
  if (current.length > 0) groups.push(current);

  const synagogues = [];

  for (const group of groups) {
    // Skip header/title groups
    if (group.length < 2) continue;
    if (group.some(el => HEADER_TEXTS.has(el.text))) continue;

    const phones = group.filter(el => el.links.length > 0).map(el => el.links[0]);
    const nonPhone = group.filter(el => el.links.length === 0);

    if (nonPhone.length < 2) continue;

    const first = nonPhone[0].text;
    const last = nonPhone[nonPhone.length - 1].text;

    let name, address;

    // If first item ends with a digit → address-first format
    if (/\d$/.test(first)) {
      address = first;
      name = last; // last non-phone item is the synagogue name
    } else if (/\d$/.test(last)) {
      // Synagogue-name-first format (last item is the address)
      name = first;
      address = last;
    } else {
      // Fallback: first item = name, no clear address
      name = first;
      address = '';
    }

    if (!name || name === address) continue;

    let addr = address
      .replace(/,?\s*Israel$/i, '')
      .replace(/,?\s*ישראל$/i, '')
      .trim();
    if (!addr.includes('נתיבות')) addr = addr ? `${addr}, נתיבות` : 'נתיבות';

    const entry = { name, address: addr, destinationId: DESTINATION_ID };
    if (phones.length > 0) {
      const cleanPhone = phones[0].replace(/^[^0-9+]+/, '').trim();
      if (cleanPhone) entry.phone = cleanPhone;
    }
    synagogues.push(entry);
  }

  console.error(`Extracted ${synagogues.length} synagogues`);
  if (synagogues.length > 0) console.error('Sample:', JSON.stringify(synagogues.slice(0, 3)));

  const outPath = path.join(__dirname, '..', 'import-netivot-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
  console.log(`Saved ${synagogues.length} synagogues`);

  await browser.close();
})();
