const fs = require('fs');
const path = require('path');

const DEST_ID = 369;
const CITY = 'שדרות';

const raw = fs.readFileSync(path.join(__dirname, '..', 'sderot-raw.txt'), 'utf8');

const blocks = raw.split(/\n\n+/);

const synagogues = [];
const seen = new Set();

for (const block of blocks) {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) continue;

  let idx = 0;
  let name = '';

  if (lines[0] === 'כתובת') {
    idx = 2;
    if (idx >= lines.length) continue;
    name = lines[idx];
    idx++;
  } else {
    name = lines[0];
    idx = 1;
  }

  if (!name) continue;

  let denomination = '';
  let gabbai = '';
  let address = '';

  while (idx < lines.length) {
    const line = lines[idx];
    if (line === 'נוסח:') {
      idx++;
      if (idx < lines.length) denomination = lines[idx];
    } else if (line === 'שם גבאי:') {
      idx++;
      if (idx < lines.length) gabbai = lines[idx].replace(/\s*[;；]\s*$/, '').trim();
    } else if (line === 'טלפון גבאי:') {
      idx++;
    } else if (line === 'כתובת:') {
      idx++;
      if (idx < lines.length) address = lines[idx];
    }
    idx++;
  }

  // Normalize address
  if (!address || address === CITY) {
    address = CITY;
  } else {
    // Strip leading "רח'" / "רחוב" prefix
    address = address.replace(/^רח[׳']\s*/, '').replace(/^רחוב\s+/, '');
    // Fix missing space before city
    address = address.replace(/(\S)שדרות/, '$1 שדרות');
    // Replace trailing " שדרות" with ", שדרות"
    address = address.replace(/\s+שדרות$/, `, ${CITY}`);
    if (!address.includes(CITY)) address += `, ${CITY}`;
  }

  const key = `${name}|${address}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const entry = { name, address, destinationId: DEST_ID };
  if (denomination) entry.denomination = denomination;

  const descParts = [];
  if (gabbai) descParts.push(`שם גבאי - ${gabbai}`);
  if (descParts.length > 0) entry.description = descParts.join('\n');

  synagogues.push(entry);
}

console.error(`Total synagogues: ${synagogues.length}`);
console.error('Sample:', JSON.stringify(synagogues.slice(0, 5), null, 2));

const outPath = path.join(__dirname, '..', 'import-sderot-synagogues.json');
fs.writeFileSync(outPath, JSON.stringify(synagogues, null, 2), 'utf8');
console.log(`Saved ${synagogues.length} synagogues to ${outPath}`);
