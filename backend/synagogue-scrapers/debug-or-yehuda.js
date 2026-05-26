const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });
  await page.goto('https://www.oryehudat.co.il/%D7%91%D7%AA%D7%99-%D7%9B%D7%A0%D7%A1%D7%AA/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Body text:\n', bodyText);

  // Check for common patterns
  const checks = await page.evaluate(() => {
    return {
      drts: document.querySelectorAll('div.drts-view-entity-container').length,
      tables: document.querySelectorAll('table').length,
      wix: document.querySelectorAll('[data-testid="richTextElement"]').length,
      lists: document.querySelectorAll('ul li, ol li').length,
      articles: document.querySelectorAll('article').length,
      divRows: document.querySelectorAll('.row, .synagogue, .shul, [class*="synagogue"], [class*="beit"]').length,
    };
  });
  console.log('\nElement counts:', checks);

  const html = await page.content();
  fs.writeFileSync(path.join(__dirname, 'or-yehuda-debug.html'), html, 'utf8');
  console.log('\nHTML saved, size:', html.length);
  await browser.close();
})();
