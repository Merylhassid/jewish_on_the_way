const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, '..', 'pt-raw.txt'), 'utf8');

// Strip footer instructions
const footerIdx = raw.indexOf('פתח תקוה ID 346');
const text = footerIdx > 0 ? raw.substring(0, footerIdx) : raw;

const lines = text.split('\n').map(l => l.replace(/[‏‎‭‬‪‫]/g, '').trim());

function reformatAddress(addr) {
  if (!addr) return 'פתח תקווה';
  // Remove ", Israel" suffix and trailing city already there
  addr = addr.replace(/,?\s*Israel$/i, '').replace(/,?\s*ישראל$/i, '').trim();
  // Remove trailing ", פתח תקווה" if present (we'll add it back)
  addr = addr.replace(/,?\s*פתח תקווה\s*$/i, '').trim();
  if (!addr) return 'פתח תקווה';
  // Reformat NUMBER STREET → STREET NUMBER
  const m = addr.match(/^(\d+)\s+(.+)$/);
  if (m) addr = `${m[2].trim()} ${m[1]}`;
  return `${addr}, פתח תקווה`;
}

function extractPhone(raw) {
  if (!raw) return '';
  // Strip RTL marks
  const s = raw.replace(/[‏‎‭‬‪‫]/g, '').trim();
  // Format: "name - phone" or "name: phone"
  const dashMatch = s.match(/[\-–]\s*(0\d[\d\-]{7,10})/);
  if (dashMatch) return dashMatch[1];
  const phoneMatch = s.match(/0\d[\d\-]{7,10}/);
  if (phoneMatch) return phoneMatch[0];
  // Digits only (missing leading 0)
  const digitsOnly = s.match(/^5\d{7,9}$/);
  if (digitsOnly) return '0' + s;
  return s.replace(/[^\d\-]/g, '');
}

const synagogues = [];
const seen = new Set();

let i = 0;
while (i < lines.length) {
  const line = lines[i];

  // Skip blank lines and footer/instructions
  if (!line || line.startsWith('שיעורי הדף היומי') || line === 'בקרוב מידע') {
    i++;
    continue;
  }

  // Find a waze line — the line before it is the synagogue name
  if (lines[i + 1] && lines[i + 1].startsWith('waze')) {
    const name = line;
    const wazeLine = lines[i + 1];
    // Extract address from waze line: "waze ADDRESS, פתח תקווה, Israel"
    const wazeMatch = wazeLine.match(/^waze\s*(.*?),\s*פתח תקו[ו]?[ה|אה]/);
    const rawAddr = wazeMatch ? wazeMatch[1].trim() : '';
    const address = reformatAddress(rawAddr);

    let denomination = '';
    let gabbaiName = '';
    let phone = '';
    let j = i + 2;

    while (j < lines.length) {
      if (lines[j] === 'נוסח:') { denomination = lines[j + 1] || ''; j += 2; continue; }
      if (lines[j] === 'שם גבאי:') { gabbaiName = lines[j + 1] || ''; j += 2; continue; }
      if (lines[j] === 'טלפון גבאי:') {
        const raw = lines[j + 1] || '';
        // Take first phone if multiple separated by /
        phone = extractPhone(raw.split('/')[0]);
        j += 2;
        continue;
      }
      if (lines[j] === 'כתובת גבאי:') { j += 2; continue; } // skip gabbai address
      if (lines[j] === 'שיעורי הדף היומי:') { j += 2; continue; }
      // Next synagogue starts when next line after current is a waze line
      if (lines[j + 1] && lines[j + 1].startsWith('waze')) break;
      // Or if this line itself is a waze line (consecutive synagogue without blank)
      if (lines[j].startsWith('waze')) break;
      j++;
    }

    const key = `${name}|${address}`;
    if (!seen.has(key)) {
      seen.add(key);
      const entry = { name, address, destinationId: 346 };
      if (denomination) entry.denomination = denomination;
      if (phone) entry.phone = phone;
      synagogues.push(entry);
    }

    i = j;
  } else {
    i++;
  }
}

console.error(`Parsed ${synagogues.length} unique synagogues`);
console.error('Sample:', JSON.stringify(synagogues.slice(0, 5), null, 2));

const outPath = path.join(__dirname, '..', 'import-petah-tikva-synagogues.json');
fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
console.log(`Saved ${synagogues.length} synagogues to ${outPath}`);
