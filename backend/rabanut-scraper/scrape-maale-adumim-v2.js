const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://mdmaad.glide.page/dl/d0a5f4';
const DEST_ID = 343;
const CITY = 'מעלה אדומים';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const page = await ctx.newPage();

  // Intercept all JSON responses to find Glide data
  const capturedData = [];
  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') || url.includes('firestore') || url.includes('glide') || url.includes('googleapis')) {
      try {
        const text = await response.text();
        if (text.length > 500 && (text.includes('מעלה') || text.includes('כתובת') || text.includes('נוסח') || text.includes('adumim') || text.includes('synagogue'))) {
          capturedData.push({ url, text: text.substring(0, 2000) });
          console.log(`Captured interesting response from: ${url}`);
          console.log(`  Preview: ${text.substring(0, 200)}`);
        }
      } catch {}
    }
  });

  console.log('Loading page...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait longer for Firebase/Glide to initialize and render
  console.log('Waiting 10s for app to render...');
  await page.waitForTimeout(10000);

  // Check body text now
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text length:', bodyText.length);
  console.log('Body text preview:', bodyText.substring(0, 500));

  // Get all visible text elements
  const allElements = await page.evaluate(() => {
    const results = [];
    // Look for any element that has Hebrew text and looks like a synagogue name
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0) { // leaf nodes only
        const text = el.innerText?.trim();
        if (text && /[֐-׿]/.test(text) && text.length > 3 && text.length < 100) {
          results.push({
            tag: el.tagName,
            class: el.className?.toString().substring(0, 80),
            text
          });
        }
      }
    });
    return results.slice(0, 50);
  });

  console.log('\nHebrew text elements found:', allElements.length);
  allElements.forEach(el => console.log(`  <${el.tag}> "${el.text}" [${el.class}]`));

  await page.screenshot({ path: path.join(__dirname, 'maale_adumim_v2.png') });

  // Try scrolling to trigger lazy loading
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);

  const bodyText2 = await page.evaluate(() => document.body.innerText);
  console.log('\nAfter scroll - body text length:', bodyText2.length);
  console.log('After scroll - preview:', bodyText2.substring(0, 300));

  // Save captured API data
  if (capturedData.length > 0) {
    console.log('\n=== Captured API responses: ===');
    capturedData.forEach((d, i) => {
      console.log(`\n[${i}] ${d.url}`);
      console.log(d.text.substring(0, 500));
    });
    fs.writeFileSync(path.join(__dirname, 'glide_api_data.json'), JSON.stringify(capturedData, null, 2), 'utf8');
  }

  await browser.close();
})();
