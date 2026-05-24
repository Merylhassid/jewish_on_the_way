const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const page = await ctx.newPage();

  await page.goto('https://mdmaad.glide.page/dl/d0a5f4', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Dump outer HTML of the body to a file so we can inspect structure
  const html = await page.evaluate(() => document.body.outerHTML);
  fs.writeFileSync(path.join(__dirname, 'maale_adumim_debug.html'), html, 'utf8');
  console.log('HTML saved, length:', html.length);

  // Find all elements that look like synagogue cards (have Hebrew text with address + name pattern)
  const info = await page.evaluate(() => {
    const results = [];
    // Look at all elements with role="button" or clickable items
    const clickables = document.querySelectorAll('[role="button"], [role="listitem"], [tabindex="0"]');
    clickables.forEach((el, i) => {
      const text = el.innerText?.trim();
      if (text && text.length > 5 && text.length < 300) {
        results.push({
          i,
          tag: el.tagName,
          classes: el.className?.toString().substring(0, 100),
          text: text.substring(0, 100),
        });
      }
    });
    return results.slice(0, 20);
  });

  console.log('\nClickable elements:');
  info.forEach(el => console.log(`  [${el.i}] <${el.tag}> class="${el.classes}" | "${el.text}"`));

  // Also try to get page full text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\nFirst 1000 chars of body text:\n', bodyText.substring(0, 1000));

  await browser.close();
})();
