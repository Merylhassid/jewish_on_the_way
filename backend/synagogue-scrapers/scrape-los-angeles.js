const { chromium } = require('playwright');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'jewish-on-the-way/1.0' } });
  const data = await res.json();
  if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Intercept API calls
  const apiResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api') || url.includes('centers') || url.includes('location') || url.includes('json')) {
      try {
        const text = await response.text().catch(() => '');
        if (text.includes('"name"') || text.includes('"address"') || text.includes('"lat"')) {
          apiResponses.push({ url, text: text.substring(0, 500) });
          console.log('API FOUND:', url);
        }
      } catch {}
    }
  });

  console.log('Loading LA Chabad list...');
  await page.goto('https://www.chabad.org/jewish-centers/location/2-90001/Los-Angeles-California-USA', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  // Wait for Cloudflare challenge to pass and content to load
  await sleep(8000);
  console.log('API responses found:', apiResponses.length);
  apiResponses.forEach(r => console.log(' -', r.url, '|', r.text.substring(0, 100)));

  // Wait for center list to appear
  await page.waitForSelector('a[href*="/centers/"]', { timeout: 15000 }).catch(() => {});
  await sleep(2000);

  // Save HTML for debugging
  const html = await page.content();
  fs.writeFileSync('la-debug.html', html);

  // Extract all links to find the pattern
  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: a.innerText.trim().substring(0, 60) }))
      .filter(l => l.text && l.href);
  });
  console.log('Sample links:');
  allLinks.slice(0, 30).forEach(l => console.log(`  ${l.href} | ${l.text}`));

  // Extract all center links - try multiple patterns
  const centerLinks = await page.evaluate(() => {
    // chabad.org uses /media/... or /community/... for centers
    const patterns = ['/community/', '/jewish-centers/', '/chabadcenters/', 'chabad.org/'];
    const links = Array.from(document.querySelectorAll('a[href]'));
    const found = links
      .map(a => ({ href: a.href, name: a.innerText.trim() }))
      .filter(l => l.name.length > 3 && l.href.includes('chabad.org') &&
        !l.href.includes('#') && !l.href.includes('search') &&
        (l.href.includes('/community/') || l.href.match(/chabad\.org\/\d+/)));
    return [...new Map(found.map(l => [l.href, l])).values()];
  });

  console.log(`\nFound ${centerLinks.length} center links`);
  if (centerLinks.length === 0) {
    console.log('No centers found - check la-debug.html');
    await browser.close();
    return;
  }

  const results = [];

  for (let i = 0; i < centerLinks.length; i++) {
    const link = centerLinks[i];
    console.log(`[${i + 1}/${centerLinks.length}] ${link.name}`);

    try {
      const detailPage = await browser.newPage();
      await detailPage.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);
      await sleep(1000);

      const details = await detailPage.evaluate(() => {
        const getText = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.innerText.trim() : null;
        };

        // Address
        const addressEl = document.querySelector('[itemprop="address"], .address, .location-address');
        const address = addressEl ? addressEl.innerText.trim().replace(/\n/g, ', ') : null;

        // Phone
        const phoneEl = document.querySelector('[itemprop="telephone"], a[href^="tel:"], .phone');
        const phone = phoneEl ? (phoneEl.getAttribute('href') || phoneEl.innerText).replace('tel:', '').trim() : null;

        // Website
        const websiteEl = document.querySelector('a[href^="http"]:not([href*="chabad.org"])');
        const website = websiteEl ? websiteEl.href : null;

        // Rabbi
        const rabbiEl = document.querySelector('.rabbi-name, [itemprop="name"].rabbi, .staff-name');
        const rabbi = rabbiEl ? rabbiEl.innerText.trim() : null;

        // Coordinates from meta or schema
        const latEl = document.querySelector('[itemprop="latitude"]');
        const lonEl = document.querySelector('[itemprop="longitude"]');
        const lat = latEl ? parseFloat(latEl.getAttribute('content') || latEl.innerText) : null;
        const lon = lonEl ? parseFloat(lonEl.getAttribute('content') || lonEl.innerText) : null;

        return { address, phone, website, rabbi, lat, lon };
      });

      await detailPage.close();

      const entry = {
        name: link.name,
        address: details.address,
        phone: details.phone,
        website: details.website,
        description: details.rabbi ? `רב - ${details.rabbi}` : undefined,
        denomination: 'חב"ד',
        destinationId: 465,
      };

      // Use embedded coordinates if available
      if (details.lat && details.lon) {
        entry.latitude = details.lat;
        entry.longitude = details.lon;
        console.log(`  coords from page: ${details.lat}, ${details.lon}`);
      } else if (details.address) {
        // Geocode via Nominatim
        await sleep(1100);
        const coords = await geocode(details.address);
        if (coords) {
          entry.latitude = coords.lat;
          entry.longitude = coords.lon;
          console.log(`  geocoded: ${coords.lat}, ${coords.lon}`);
        } else {
          console.log(`  geocode failed`);
        }
      }

      results.push(entry);
      console.log(`  address: ${details.address}`);

    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      results.push({ name: link.name, denomination: 'חב"ד', destinationId: 465 });
    }

    await sleep(500);
  }

  fs.writeFileSync('../import-los-angeles-synagogues.json', JSON.stringify(results, null, 2));
  console.log(`\nDone! Saved ${results.length} entries`);
  await browser.close();
})();
