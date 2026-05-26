const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });
  await page.goto('https://mdrl.org.il/%D7%91%D7%AA%D7%99-%D7%9B%D7%A0%D7%A1%D7%AA/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => ({
    tables: document.querySelectorAll('table').length,
    allRows: document.querySelectorAll('table tr').length,
    dataRows: document.querySelectorAll('table tbody tr').length,
    firstRow: document.querySelector('table tbody tr')?.outerHTML?.substring(0, 800) || 'none',
    pageLinks: Array.from(document.querySelectorAll('a')).filter(a => /^\d+$/.test(a.textContent.trim())).map(a => a.textContent.trim()).slice(0,15),
    bodySnippet: document.body.innerText.substring(0, 500),
  }));

  console.log(JSON.stringify(info, null, 2));
  fs.writeFileSync(path.join(__dirname, 'rishon-debug.html'), await page.content(), 'utf8');
  console.log('HTML saved, size:', (await page.content()).length);
  await browser.close();
})();
