'use strict';

/*
 * Builds a review gallery with one proposed image for every child destination.
 * Uses Wikipedia/Wikimedia page images only. No Google API, no DB writes.
 *
 * Usage:
 *   node scripts/build-all-city-image-candidates.js
 */

const fs = require('fs');
const path = require('path');

const PLAN_CSV = path.join(__dirname, '..', 'audit-output', 'city-image-plan.csv');
const OUT_HTML = path.join(__dirname, '..', 'audit-output', 'all-city-image-candidates.html');
const OUT_CSV = path.join(__dirname, '..', 'audit-output', 'all-city-image-candidates.csv');

const WIKI_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
const COMMONS_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

const EXACT_TITLE_ALIASES = {
  akko: ['Acre, Israel', 'Acre'],
  "be'er sheva": ['Beersheba'],
  "be'er yaakov": ["Be'er Ya'akov"],
  "beit she'an": ["Beit She'an"],
  'beit shemesh': ['Beit Shemesh'],
  'bnei brak': ['Bnei Brak'],
  'gan yavne': ['Gan Yavne'],
  'givat shmuel': ["Giv'at Shmuel"],
  givatayim: ['Givataim'],
  "hod hasharon": ['Hod HaSharon'],
  'kiryat ata': ['Kiryat Ata'],
  'kiryat bialik': ['Kiryat Bialik'],
  'kiryat gat': ['Kiryat Gat'],
  'kiryat motzkin': ['Kiryat Motzkin'],
  'kiryat ono': ['Kiryat Ono'],
  'kiryat shmona': ['Kiryat Shmona'],
  "ma'ale adumim": ["Ma'ale Adumim"],
  'mazkeret batya': ['Mazkeret Batya'],
  'mevaseret zion': ['Mevaseret Zion'],
  'migdal haemek': ["Migdal HaEmek", "Migdal Ha'emek"],
  modiin: ["Modi'in-Maccabim-Re'ut", "Modi'in"],
  'ness ziona': ['Ness Ziona'],
  'or yehuda': ['Or Yehuda'],
  'pardes hanna': ['Pardes Hanna-Karkur', 'Pardes Hanna'],
  'petah tikva': ['Petah Tikva'],
  "ra'anana": ["Ra'anana"],
  'ramat gan': ['Ramat Gan'],
  'ramat hasharon': ['Ramat HaSharon'],
  'rishon lezion': ['Rishon LeZion'],
  'rosh haayin': ['Rosh HaAyin'],
  'rosh pina': ['Rosh Pinna'],
  'tel aviv': ['Tel Aviv'],
  'tel mond': ['Tel Mond'],
  tzfat: ['Safed'],
  yokneam: ["Yokneam Illit", "Yoqne'am Illit"],
  'zichron yaakov': ["Zikhron Ya'akov"],
  'ko samui': ['Ko Samui'],
  'koh phangan': ['Ko Pha-ngan'],
  phuket: ['Phuket province', 'Phuket'],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text) {
  const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/);
  const header = lines.shift().split(',');
  return lines.map((line) => {
    const cols = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']));
  });
}

function normalizeCity(city) {
  return String(city || '')
    .replace(/\bBe'er\b/i, "Beersheba")
    .replace(/\bAkko\b/i, 'Acre')
    .replace(/\bTiberias\b/i, 'Tiberias')
    .trim();
}

function citySearchTerms(row) {
  const city = normalizeCity(row.city || row.name);
  const country = row.country || '';
  const code = row.country_code || '';
  const terms = [
    `${city} ${country}`,
    `${city} city ${country}`,
    `${city} skyline ${country}`,
  ];
  if (code === 'IL') {
    terms.unshift(`${city} Israel city`);
  }
  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
}

function exactTitles(row) {
  const city = String(row.city || row.name || '').trim();
  const key = city.toLowerCase();
  const aliases = EXACT_TITLE_ALIASES[key] || [];
  return [...new Set([...aliases, city, `${city}, ${row.country}`].filter(Boolean))];
}

function isBadImage(url) {
  const u = String(url || '').toLowerCase();
  return (
    !u ||
    u.endsWith('.svg') ||
    u.includes('commons-logo') ||
    u.includes('wikimedia-logo') ||
    u.includes('symbol') ||
    u.includes('coat_of_arms') ||
    u.includes('seal_') ||
    u.includes('flag_')
  );
}

function isBadTitle(title) {
  const t = String(title || '').toLowerCase();
  return (
    t.includes('flag') ||
    t.includes('coat of arms') ||
    t.includes('coat_of_arms') ||
    t.includes('seal') ||
    t.includes('logo') ||
    t.includes('map') ||
    t.includes('svg')
  );
}

async function wikiSearch(term) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: term,
    gsrlimit: '5',
    prop: 'pageimages|info',
    piprop: 'thumbnail|original',
    pithumbsize: '900',
    inprop: 'url',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKI_ENDPOINT}?${params.toString()}`, {
    headers: { 'User-Agent': 'jewish-on-the-way-city-image-review/1.0' },
  });
  if (!res.ok) throw new Error(`Wikipedia ${res.status} for ${term}`);
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {});
  return pages
    .map((page) => ({
      title: page.title || '',
      page_url: page.fullurl || '',
      image_url: page.thumbnail?.source || page.original?.source || '',
      width: page.thumbnail?.width || page.original?.width || '',
      height: page.thumbnail?.height || page.original?.height || '',
      search_term: term,
    }))
    .filter((item) => item.image_url && !isBadImage(item.image_url));
}

async function wikiExactTitle(title) {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    redirects: '1',
    prop: 'pageimages|info',
    piprop: 'thumbnail|original',
    pithumbsize: '1000',
    inprop: 'url',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKI_ENDPOINT}?${params.toString()}`, {
    headers: { 'User-Agent': 'jewish-on-the-way-city-image-review/1.0' },
  });
  if (!res.ok) throw new Error(`Wikipedia ${res.status} for ${title}`);
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {}).filter((page) => !page.missing);
  return pages
    .map((page) => ({
      title: page.title || '',
      page_url: page.fullurl || '',
      image_url: page.thumbnail?.source || page.original?.source || '',
      width: page.thumbnail?.width || page.original?.width || '',
      height: page.thumbnail?.height || page.original?.height || '',
      search_term: title,
    }))
    .filter((item) => item.image_url && !isBadImage(item.image_url) && !isBadTitle(item.title));
}

async function commonsSearch(term) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: term,
    gsrlimit: '10',
    prop: 'imageinfo|info',
    iiprop: 'url|mime|size',
    iiurlwidth: '900',
    inprop: 'url',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${COMMONS_ENDPOINT}?${params.toString()}`, {
    headers: { 'User-Agent': 'jewish-on-the-way-city-image-review/1.0' },
  });
  if (!res.ok) throw new Error(`Commons ${res.status} for ${term}`);
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {});
  return pages
    .map((page) => {
      const image = page.imageinfo?.[0] || {};
      return {
        title: String(page.title || '').replace(/^File:/, ''),
        page_url: page.fullurl || '',
        image_url: image.thumburl || image.url || '',
        width: image.thumbwidth || image.width || '',
        height: image.thumbheight || image.height || '',
        mime: image.mime || '',
        search_term: term,
      };
    })
    .filter((item) => {
      const width = Number(item.width || 0);
      const height = Number(item.height || 0);
      const landscapeEnough = !width || !height || width / Math.max(height, 1) >= 1.05;
      return (
        item.image_url &&
        !isBadImage(item.image_url) &&
        !isBadTitle(item.title) &&
        /^image\/(jpeg|png|webp)$/i.test(item.mime) &&
        landscapeEnough
      );
    });
}

async function findCandidate(row) {
  for (const title of exactTitles(row)) {
    try {
      const found = await wikiExactTitle(title);
      if (found.length) return { ...found[0], status: 'candidate', provider: 'wikipedia-exact-page' };
    } catch {
      // Keep going; some smaller cities have no useful page image.
    }
    await sleep(80);
  }

  const terms = citySearchTerms(row);
  for (const term of terms) {
    try {
      const found = await wikiSearch(term);
      if (found.length) return { ...found[0], status: 'candidate', provider: 'wikipedia-pageimage' };
    } catch {
      // Keep going; the gallery must still provide a visual fallback.
    }
    await sleep(80);
  }
  for (const term of terms) {
    try {
      const found = await commonsSearch(term);
      if (found.length) return { ...found[0], status: 'candidate', provider: 'wikimedia-commons' };
    } catch {
      // Keep going; the gallery must still provide a visual fallback.
    }
    await sleep(80);
  }
  return {
    status: 'needs-manual-source',
    provider: '',
    title: '',
    page_url: '',
    image_url: '',
    width: '',
    height: '',
    search_term: terms[0] || '',
  };
}

(async () => {
  const cities = parseCsv(fs.readFileSync(PLAN_CSV, 'utf8'));
  const results = [];
  for (let i = 0; i < cities.length; i += 1) {
    const row = cities[i];
    process.stdout.write(`\r${i + 1}/${cities.length} ${row.city || row.name}`.padEnd(80));
    try {
      const candidate = await findCandidate(row);
      results.push({
        id: row.id,
        city: row.city || row.name,
        name_he: row.name_he,
        country: row.country,
        country_code: row.country_code,
        restaurants: row.restaurants,
        status: candidate.status,
        provider: candidate.provider,
        image_url: candidate.image_url,
        page_title: candidate.title,
        page_url: candidate.page_url,
        search_term: candidate.search_term,
      });
    } catch (err) {
      results.push({
        id: row.id,
        city: row.city || row.name,
        name_he: row.name_he,
        country: row.country,
        country_code: row.country_code,
        restaurants: row.restaurants,
        status: 'error',
        provider: '',
        image_url: '',
        page_title: '',
        page_url: '',
        search_term: '',
        error: err.message,
      });
    }
    await sleep(120);
  }
  process.stdout.write('\n');

  const header = [
    'id',
    'city',
    'name_he',
    'country',
    'country_code',
    'restaurants',
    'status',
    'provider',
    'image_url',
    'page_title',
    'page_url',
    'search_term',
    'error',
  ];
  fs.writeFileSync(
    OUT_CSV,
    '\ufeff' + [header.join(','), ...results.map((row) => header.map((h) => csvEsc(row[h])).join(','))].join('\n') + '\n',
    'utf8',
  );

  const ok = results.filter((row) => row.status === 'candidate').length;
  const fallback = results.filter((row) => row.status === 'needs-manual-source').length;
  const missing = results.filter((row) => row.status === 'error').length;
  const cards = results.map((row) => `
    <article class="card ${row.status !== 'candidate' ? 'missing' : ''}">
      ${row.image_url
        ? `<img src="${escHtml(row.image_url)}" alt="${escHtml(row.city)}" loading="lazy" />`
        : '<div class="empty">אין תמונה מוצעת</div>'}
      <div class="body">
        <h2>${escHtml(row.name_he || row.city)}</h2>
        <div class="meta">${escHtml(row.city)} · ${escHtml(row.country)} (${escHtml(row.country_code)})</div>
        <div class="meta">מסעדות: ${escHtml(row.restaurants)} · סטטוס: ${escHtml(row.status)} · מקור: ${escHtml(row.provider)}</div>
        <div class="meta">חיפוש: ${escHtml(row.search_term)}</div>
        ${row.page_url ? `<a href="${escHtml(row.page_url)}" target="_blank" rel="noreferrer">מקור: ${escHtml(row.page_title)}</a>` : ''}
        ${row.image_url ? `<a href="${escHtml(row.image_url)}" target="_blank" rel="noreferrer">פתח תמונה</a>` : ''}
      </div>
    </article>
  `).join('');

  fs.writeFileSync(OUT_HTML, `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>All city image candidates</title>
  <style>
    body{font-family:Arial,sans-serif;margin:18px;background:#f7f8fb;color:#172033}
    h1{font-size:22px;margin:0 0 8px}
    .note{font-size:13px;line-height:1.45;margin:0 0 18px;color:#526070}
    .summary{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 18px}
    .pill{background:#0b1736;color:#fff;border-radius:6px;padding:7px 11px;font-size:13px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
    .card{background:#fff;border:1px solid #dce2ea;border-radius:10px;overflow:hidden;box-shadow:0 4px 12px rgba(11,23,54,.06)}
    .card.missing{border-color:#efcaca}
    img,.empty{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;object-fit:cover;background:#d9dee8;color:#6b7280;font-size:14px}
    .body{padding:11px 12px 13px}
    h2{font-size:16px;margin:0 0 5px}
    .meta{font-size:12.5px;color:#526070;margin:3px 0}
    a{display:inline-block;margin:8px 10px 0 0;color:#1565c0;text-decoration:none;font-size:13px}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <h1>תמונות מוצעות לכל הערים</h1>
  <p class="note">מועמד אחד לכל עיר כשנמצא מקור יציב מ-Wikipedia/Wikimedia. אם אין מקור טוב, הכרטיס מסומן כצריך בחירה ידנית במקום להציג תמונה גרועה או שבורה. אין כאן Google API ואין כתיבה ל-DB או לאפליקציה.</p>
  <div class="summary">
    <span class="pill">ערים: ${results.length}</span>
    <span class="pill">מקור Wikimedia: ${ok}</span>
    <span class="pill">צריך מקור ידני/אחר: ${fallback}</span>
    <span class="pill">שגיאה: ${missing}</span>
  </div>
  <section class="grid">${cards}</section>
</body>
</html>`, 'utf8');

  console.log({ rows: results.length, stableCandidates: ok, needsManualSource: fallback, errors: missing, outHtml: OUT_HTML, outCsv: OUT_CSV });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
