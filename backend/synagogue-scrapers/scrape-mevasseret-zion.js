const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

  const url = 'https://www.kipa.co.il/%D7%91%D7%AA%D7%99-%D7%9B%D7%A0%D7%A1%D7%AA/%D7%9E%D7%91%D7%A9%D7%A8%D7%AA-%D7%A6%D7%99%D7%95%D7%9F/';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  const title = await page.title();
  console.error('Title:', title);

  const html = await page.content();

  // Find all class names on the page
  const allClasses = html.match(/class="([^"]+)"/g) || [];
  const uniqueClasses = [...new Set(allClasses)];
  console.error('All unique classes:', uniqueClasses.slice(0, 50).join('\n'));

  // Look for any list or card-like structures
  const bodyText = await page.evaluate(() => {
    // Find sections that might contain synagogue info
    const all = document.querySelectorAll('*');
    const interesting = [];
    for (const el of all) {
      const text = el.innerText || '';
      if (text.includes('בית כנסת') || text.includes('רחוב') || text.includes('טל:')) {
        if (el.children.length < 10) {
          interesting.push(el.className + ': ' + text.substring(0, 100));
        }
      }
    }
    return interesting.slice(0, 30).join('\n---\n');
  });
  console.error('Interesting elements:\n', bodyText);

  await browser.close();
})();
