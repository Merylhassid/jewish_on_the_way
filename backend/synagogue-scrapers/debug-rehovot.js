const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  await page.goto('https://dat-rehovot.co.il/shuls-list/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    return {
      tables: document.querySelectorAll('table').length,
      rows: document.querySelectorAll('table tbody tr').length,
      pagination: document.querySelectorAll('[class*="page"], .pagination, [aria-label*="page"]').length,
      pageLinks: Array.from(document.querySelectorAll('a, button')).filter(el => /^\d+$/.test(el.textContent.trim())).map(el => ({ tag: el.tagName, text: el.textContent.trim(), class: el.className, href: el.href || '' })).slice(0, 20),
      firstRowHtml: document.querySelector('table tbody tr')?.outerHTML?.substring(0, 1000) || 'no row',
      theadHtml: document.querySelector('table thead')?.outerHTML?.substring(0, 500) || 'no thead',
    };
  });

  console.log('Tables:', info.tables);
  console.log('Rows:', info.rows);
  console.log('Page links:', JSON.stringify(info.pageLinks, null, 2));
  console.log('\nThead:', info.theadHtml);
  console.log('\nFirst row:', info.firstRowHtml);

  fs.writeFileSync(path.join(__dirname, 'rehovot-debug.html'), await page.content(), 'utf8');
  console.log('\nHTML saved');
  await browser.close();
})();
