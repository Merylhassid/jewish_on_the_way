const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  await page.goto('https://mdrl.org.il/%D7%91%D7%AA%D7%99-%D7%9B%D7%A0%D7%A1%D7%AA/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr[data-row_id]');
    const firstRow = rows[0];
    const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')).map((td, i) => ({ i, class: td.className, text: td.textContent.trim().substring(0, 60) })) : [];
    const pageItems = document.querySelectorAll('ul.pagination li.footable-page[data-page]');
    const pageNums = Array.from(pageItems).map(li => li.getAttribute('data-page'));
    return { rowCount: rows.length, cells, pageNums };
  });

  console.log('Rows on page 1:', info.rowCount);
  console.log('Page numbers:', info.pageNums);
  console.log('Columns:', JSON.stringify(info.cells, null, 2));

  fs.writeFileSync(path.join(__dirname, 'rishon-debug.html'), await page.content(), 'utf8');
  await browser.close();
})();
