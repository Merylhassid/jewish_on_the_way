const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEST_ID = process.argv[2] ? parseInt(process.argv[2]) : 0;
const CITY = 'עפולה';
const BASE_URL = 'https://mdafula.org.il/synagogue';

function extractRows(cells2d) {
  const results = [];
  for (const cells of cells2d) {
    if (cells.length >= 2) {
      const name = cells[0]?.trim();
      const address = cells[1]?.trim();
      if (name && address && !['←','→','↑','↓','+','-','Home','End','Page Up','Page Down'].includes(name)) {
        results.push({ name, address });
      }
    }
  }
  return results;
}

(async () => {
  if (!DEST_ID) {
    console.error('Usage: node scrape-afula.js <destinationId>');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Debug: dump page structure
  const structure = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const paginationEls = document.querySelectorAll('[class*="page"], [class*="pag"], nav, .pagination, button');
    return {
      title: document.title,
      tableCount: tables.length,
      firstTableRows: tables[0] ? tables[0].querySelectorAll('tr').length : 0,
      paginationText: Array.from(paginationEls).slice(0, 10).map(e => e.tagName + ':' + e.className + ':' + e.innerText?.slice(0,30)),
      bodySnippet: document.body.innerText.slice(0, 500),
    };
  });
  console.error('Page structure:', JSON.stringify(structure, null, 2));

  const synagogues = [];
  const seen = new Set();

  const processPage = async (pageNum) => {
    const cells2d = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tr, tbody tr');
      return Array.from(rows).map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      );
    });

    const rows = extractRows(cells2d);
    console.error(`  Page ${pageNum}: found ${rows.length} entries`);

    for (const { name, address } of rows) {
      // Only keep entries with עפולה in address
      if (!address.includes(CITY) && !address.includes('Afula')) {
        console.error(`  Skipping non-Afula: ${name} | ${address}`);
        continue;
      }

      let addr = address
        .replace(/,?\s*ישראל\s*$/i, '')
        .replace(/,?\s*Israel\s*$/i, '')
        .replace(/,?\s*עפולה\s*$/i, '')
        .trim();

      addr = addr ? `${addr}, ${CITY}` : CITY;

      const key = `${name}|${addr}`;
      if (seen.has(key)) { console.error(`  Duplicate: ${name}`); return; }
      seen.add(key);

      synagogues.push({ name, address: addr, destinationId: DEST_ID });
    }
  };

  // Page 1
  await processPage(1);

  // Find pagination: try numbered buttons or next-arrow
  const pageBtns = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a, [role="button"], li'));
    return btns
      .filter(b => /^[2-9]$/.test(b.innerText?.trim()) || /next|הבא|›|»/.test(b.innerText?.trim()))
      .map(b => ({ text: b.innerText?.trim(), class: b.className, tag: b.tagName }));
  });
  console.error('Pagination buttons found:', pageBtns);

  // Find total pages from "X/Y בתי כנסת" text
  const totalText = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e =>
      /\d+\/\d+\s*בתי כנסת/.test(e.innerText) && e.children.length === 0
    );
    return el?.innerText || '';
  });
  console.error('Total text:', totalText);
  const totalMatch = totalText.match(/(\d+)\/(\d+)/);
  const perPage = totalMatch ? parseInt(totalMatch[1]) : 10;
  const total = totalMatch ? parseInt(totalMatch[2]) : 40;
  const totalPages = Math.ceil(total / perPage);
  console.error(`Pages: ${totalPages} (${total} total, ${perPage} per page)`);

  // Click BUTTON pagination elements (exact text match, not anchors)
  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    // Find button with exactly this page number (not an anchor)
    const clicked = await page.evaluate(async (num) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.trim() === String(num) &&
        b.className.includes('cursor-pointer'));
      if (btn) { btn.click(); return true; }
      return false;
    }, pageNum);

    if (clicked) {
      await page.waitForTimeout(1500);
      await processPage(pageNum);
    } else {
      console.error(`  Could not find pagination button for page ${pageNum}`);
    }
  }

  await browser.close();

  console.error(`\nTotal: ${synagogues.length} synagogues`);
  const outPath = path.join(__dirname, '..', 'import-afula-synagogues.json');
  fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
  console.log(`Saved to ${outPath}`);
})();
