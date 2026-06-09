import { chromium } from 'playwright';

const CITIES = [
  'Bangkok', 'Barcelona', 'Cannes', 'Chiang Mai', 'Chicago',
  'Dallas', 'Dubai', 'Dublin', 'Ko Samui', 'Koh Phangan',
  'Larnaca', 'Las Vegas', 'Limassol', 'Los Angeles', 'Marrakech',
  'Miami', 'Nice', 'Pai', 'Paphos', 'Phuket',
  'Porto', 'Prague', 'Rome',
];

async function main() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'he-IL',
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  console.log('=== Fetching main restaurants page ===');
  await page.goto('https://globuskasher.com/%D7%9E%D7%A1%D7%A2%D7%93%D7%95%D7%AA/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(6000);

  // Print all links that might be city links
  const links = await page.$$eval('a', (els) =>
    els.map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() }))
       .filter((l) => l.href.includes('globuskasher'))
  );
  console.log('\nAll internal links:', JSON.stringify(links.slice(0, 50), null, 2));

  // Print page title + first 2000 chars of body text
  const bodyText = await page.$eval('body', (el) => el.innerText?.slice(0, 2000));
  console.log('\nBody text preview:\n', bodyText);

  // Try to find restaurant cards or list items
  const cards = await page.$$eval('[class*="restaurant"], [class*="card"], article, .post', (els) =>
    els.slice(0, 5).map((el) => ({ class: (el as HTMLElement).className, text: (el as HTMLElement).innerText?.slice(0, 200) }))
  );
  console.log('\nPotential restaurant cards:', JSON.stringify(cards, null, 2));

  // Try clicking one of the cities
  console.log('\n=== Trying Barcelona ===');
  try {
    await page.goto('https://globuskasher.com/barcelona/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    const bText = await page.$eval('body', (el) => el.innerText?.slice(0, 3000));
    console.log(bText);
  } catch (e) {
    console.log('Barcelona direct URL failed, trying search...');
  }

  await browser.close();
}
main().catch(console.error);
