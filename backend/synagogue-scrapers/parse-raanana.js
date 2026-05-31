const fs = require('fs');
const path = require('path');

const DEST_ID = 309;
const CITY = 'רעננה';

const raw = fs.readFileSync(path.join(__dirname, '..', 'raanana-raw.txt'), 'utf8');
const lines = raw.split('\n').map(l => l.replace(/[‏‎‭‬‪‫]/g, '').trim()).filter(l => l.length > 0);

function reformatAddress(wazeLine) {
  // Remove "waze" prefix
  let addr = wazeLine.replace(/^waze\s*/i, '').trim();
  // Remove ", Israel" and trailing city
  addr = addr.replace(/,?\s*Israel$/i, '').replace(/,?\s*ישראל$/i, '').trim();
  addr = addr.replace(/,?\s*רעננה\s*$/i, '').trim();
  if (!addr) return CITY;
  // Strip leading "רחוב " prefix
  addr = addr.replace(/^רחוב\s+/, '');
  // Reformat NUMBER STREET → STREET NUMBER
  const m = addr.match(/^(\d+)\s+(.+)$/);
  if (m) addr = `${m[2].trim()} ${m[1]}`;
  return `${addr}, ${CITY}`;
}

const synagogues = [];
const seen = new Set();

let i = 0;
while (i < lines.length) {
  // A synagogue entry: current line is name, next line starts with "waze"
  if (i + 1 < lines.length && lines[i + 1].toLowerCase().startsWith('waze')) {
    const name = lines[i];
    const address = reformatAddress(lines[i + 1]);
    let denomination = '';
    let j = i + 2;
    // Check for optional נוסח block immediately after
    if (j < lines.length && lines[j] === 'נוסח:') {
      denomination = lines[j + 1] || '';
      j += 2;
    }

    const key = `${name}|${address}`;
    if (!seen.has(key)) {
      seen.add(key);
      const entry = { name, address, destinationId: DEST_ID };
      if (denomination) entry.denomination = denomination;
      synagogues.push(entry);
    }
    i = j;
  } else {
    i++;
  }
}

console.error(`Parsed ${synagogues.length} unique synagogues`);
console.error('Sample:', JSON.stringify(synagogues.slice(0, 5), null, 2));

const outPath = path.join(__dirname, '..', 'import-raanana-synagogues.json');
fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
console.log(`Saved ${synagogues.length} entries`);
