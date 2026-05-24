const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });
  await page.goto('https://www.mdnetivot.org/synagogues-3', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const html = await page.content();
  const idx = html.indexOf('אהבת שלום'); // אהבת שלום
  let snippet = '';
  if (idx >= 0) {
    snippet = html.substring(Math.max(0, idx - 500), idx + 1000);
  } else {
    snippet = 'Not found. First 3000 chars:\n' + html.substring(0, 3000);
  }
  fs.writeFileSync(path.join(__dirname, 'netivot-debug.html'), html, 'utf8');
  fs.writeFileSync(path.join(__dirname, 'netivot-snippet.txt'), snippet, 'utf8');
  console.log('Written debug files. Snippet length:', snippet.length);
  await browser.close();
})();
