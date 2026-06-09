/**
 * Debug script — run from Israel to discover the kashrut.gov.il API shape.
 * Usage: npx ts-node -r tsconfig-paths/register scripts/debug-kashrut-api.ts
 */
import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.kashrut.gov.il/restaurant/',
};

async function tryUrl(label: string, url: string, params?: Record<string, string>) {
  console.log(`\n=== ${label} ===`);
  console.log('URL:', url, params ?? '');
  try {
    const res = await axios.get(url, { params, headers: HEADERS, timeout: 10_000 });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    const body = JSON.stringify(res.data).slice(0, 800);
    console.log('Body:', body);
  } catch (e: unknown) {
    const err = e as { response?: { status: number; data: unknown }; message?: string };
    if (err.response) {
      console.log('HTTP error:', err.response.status);
      console.log('Body:', JSON.stringify(err.response.data).slice(0, 400));
    } else {
      console.log('Error:', err.message);
    }
  }
  await new Promise((r) => setTimeout(r, 500));
}

async function main() {
  const base = 'https://www.kashrut.gov.il';

  // Try several known / guessed API paths
  await tryUrl('businesses API', `${base}/Kashrut/api/businesses`, { City: 'אשדוד', pageSize: '3' });
  await tryUrl('businesses – BusinessName', `${base}/Kashrut/api/businesses`, { BusinessName: 'פיצה', City: 'אשדוד', pageSize: '3' });
  await tryUrl('restaurant search page', `${base}/restaurant/`, { q: 'פיצה', city: 'אשדוד' });
  await tryUrl('GetBusinesses', `${base}/Kashrut/Services/GetBusinesses.aspx`, { City: 'אשדוד', pageSize: '3' });
  await tryUrl('api v2', `${base}/api/businesses`, { City: 'אשדוד', pageSize: '3' });
  await tryUrl('search JSON', `${base}/Kashrut/api/search`, { q: 'פיצה', city: 'אשדוד' });
}

main().catch(console.error);
