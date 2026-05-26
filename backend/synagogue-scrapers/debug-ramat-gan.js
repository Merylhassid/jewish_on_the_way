const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  await page.goto('https://mdrg.org.il/beit-kenesset-db-meida/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    return {
      tables: document.querySelectorAll('table').length,
      rows: document.querySelectorAll('table tr').length,
      xButtons: document.querySelectorAll('td.x-button, .x-button, [class*="toggle"], button, td:first-child').length,
      pagination: document.querySelectorAll('[class*="page"], [class*="pagination"], .page-numbers, a[href*="page"]').length,
      sampleHtml: document.querySelector('table')?.outerHTML?.substring(0, 2000) || 'no table',
      pageLinks: Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('page') || /^\d+$/.test(a.textContent.trim())).map(a => ({ text: a.textContent.trim(), href: a.href })).slice(0, 20),
    };
  });

  console.log('Tables:', info.tables);
  console.log('Rows:', info.rows);
  console.log('xButtons:', info.xButtons);
  console.log('Pagination links:', JSON.stringify(info.pageLinks, null, 2));
  console.log('\nSample HTML:\n', info.sampleHtml);

  fs.writeFileSync(path.join(__dirname, 'ramat-gan-debug.html'), await page.content(), 'utf8');
  console.log('\nFull HTML saved');
  await browser.close();
})();
