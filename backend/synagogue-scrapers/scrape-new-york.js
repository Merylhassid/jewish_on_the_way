const { chromium } = require('playwright');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function extractDetailsFromSite(browser, url) {
  if (!url || url === '#') return {};
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(1500);

    const details = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Try to find address via structured data
      const schemaEl = document.querySelector('[itemprop="streetAddress"], [itemprop="address"]');
      let address = schemaEl ? schemaEl.innerText.trim() : null;

      // Try common address patterns
      if (!address) {
        const addrPatterns = [
          /\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Road|Rd|Blvd|Boulevard|Drive|Dr|Lane|Ln|Way|Place|Pl)[,\s]+[A-Za-z\s]+,?\s*(NY|New York)/i
        ];
        for (const pat of addrPatterns) {
          const m = bodyText.match(pat);
          if (m) { address = m[0].trim(); break; }
        }
      }

      // Phone
      const phoneEl = document.querySelector('[itemprop="telephone"], a[href^="tel:"]');
      let phone = phoneEl
        ? (phoneEl.getAttribute('href') || phoneEl.innerText).replace('tel:', '').trim()
        : null;
      if (!phone) {
        const m = bodyText.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
        if (m) phone = m[0];
      }

      // Coordinates from schema
      const latEl = document.querySelector('[itemprop="latitude"]');
      const lonEl = document.querySelector('[itemprop="longitude"]');
      const lat = latEl ? parseFloat(latEl.getAttribute('content') || latEl.innerText) : null;
      const lon = lonEl ? parseFloat(lonEl.getAttribute('content') || lonEl.innerText) : null;

      return { address, phone, lat, lon };
    });

    await page.close();
    return details;
  } catch (e) {
    try { await page.close(); } catch {}
    return {};
  }
}

async function geocode(address) {
  await sleep(1100);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'jewish-on-the-way/1.0' } });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'he-IL',
  });
  const page = await context.newPage();

  console.log('Loading NY synagogues page...');
  await page.goto('https://www.ny-see.co.il/synagogue', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  // Keep clicking "לעוד בתי כנסת" until no more
  let clicks = 0;
  for (let attempt = 0; attempt < 30; attempt++) {
    const btn = await page.$('button:has-text("לעוד"), a:has-text("לעוד")');
    if (!btn) break;
    // Check if disabled
    const disabled = await btn.evaluate(el => el.disabled || el.getAttribute('disabled') !== null || el.classList.contains('disabled'));
    if (disabled) { console.log('Button disabled - all loaded'); break; }
    console.log(`Clicking load more (${++clicks})...`);
    await btn.click().catch(() => {});
    await sleep(2500);
  }
  console.log(`Done loading. Clicked ${clicks} times.`);

  // Save HTML for inspection
  const html = await page.content();
  fs.writeFileSync('ny-debug.html', html);
  console.log('Saved debug HTML, size:', html.length);

  // Extract all synagogue cards from Wix repeater structure
  const cards = await page.evaluate(() => {
    const results = [];

    // Each card image has title = synagogue name, and a GUID-based ID like comp-XXX__GUID
    const images = Array.from(document.querySelectorAll('.wixui-image[title]'));

    images.forEach(imgEl => {
      const name = imgEl.getAttribute('title');
      if (!name || name.length < 3) return;

      // Extract GUID from element ID (part after __)
      const idMatch = imgEl.id.match(/__(.+)$/);
      if (!idMatch) return;
      const guid = idMatch[1];

      // Find all elements in this card by matching GUID
      const cardEls = Array.from(document.querySelectorAll(`[id$="__${guid}"]`));

      let stream = null;
      let website = null;

      cardEls.forEach(el => {
        const text = el.innerText ? el.innerText.trim() : '';
        // h3 contains the stream
        const h3 = el.querySelector('h3');
        if (h3) {
          const h3text = h3.innerText.trim();
          if (h3text.includes('אורתודוקסי') || h3text.includes('חב"ד') || h3text.includes('חבד') ||
              h3text.includes('קונסרבטיבי') || h3text.includes('רפורמי')) {
            stream = h3text;
          }
        }
        // Link button
        const link = el.querySelector('a[href^="http"]');
        if (link && !link.href.includes('ny-see.co.il')) {
          website = link.href;
        }
      });

      results.push({ name, stream, website });
    });

    return results;
  });

  console.log(`Found ${cards.length} cards total`);

  // If cards is empty, save debug and try alternative
  if (cards.length === 0) {
    const html = await page.content();
    fs.writeFileSync('ny-debug.html', html);
    console.log('Saved ny-debug.html');
    await browser.close();
    return;
  }

  // Show all found
  cards.forEach((c, i) => console.log(`  ${i+1}. [${c.stream}] ${c.name}`));

  // Filter only Orthodox and Chabad
  const filtered = cards.filter(c =>
    c.stream && (c.stream.includes('אורתודוקסי') || c.stream.includes('חבד') || c.stream.includes('חב"ד'))
  );
  console.log(`\nFiltered: ${filtered.length} Orthodox/Chabad`);

  await page.close();

  const results = [];
  for (let i = 0; i < filtered.length; i++) {
    const card = filtered[i];
    console.log(`\n[${i + 1}/${filtered.length}] ${card.name} (${card.stream})`);

    const entry = {
      name: card.name,
      denomination: card.stream,
      website: card.website,
      destinationId: 463,
    };

    // Try to get details from website
    if (card.website) {
      console.log(`  Visiting: ${card.website}`);
      const details = await extractDetailsFromSite(browser, card.website);
      if (details.address) {
        entry.address = details.address;
        console.log(`  address: ${details.address}`);
      }
      if (details.phone) {
        entry.phone = details.phone;
        console.log(`  phone: ${details.phone}`);
      }
      if (details.lat && details.lon) {
        entry.latitude = details.lat;
        entry.longitude = details.lon;
        console.log(`  coords from site: ${details.lat}, ${details.lon}`);
      } else if (details.address) {
        const coords = await geocode(details.address);
        if (coords) {
          entry.latitude = coords.lat;
          entry.longitude = coords.lon;
          console.log(`  geocoded: ${coords.lat}, ${coords.lon}`);
        }
      }
    }

    results.push(entry);
  }

  fs.writeFileSync('../import-new-york-synagogues.json', JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} entries to import-new-york-synagogues.json`);
  await browser.close();
})();
