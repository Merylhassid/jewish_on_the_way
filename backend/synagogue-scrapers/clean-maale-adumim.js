const fs = require('fs');
const path = require('path');

const inPath  = path.join(__dirname, '..', 'import-maale-adumim-synagogues.json');
const outPath = inPath;

const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));

const cleaned = data.map(s => {
  // Fix שלום לעם — bad address/denomination from parsing failure
  if (s.name === 'שלום לעם') {
    s.address = 'מעלה אדומים';
    delete s.denomination;
    delete s.description;
    return s;
  }

  // Clean description: keep only the prayer-times part (before "תמונות")
  if (s.description) {
    // Remove everything from "תמונות" onwards (with or without leading newline)
    const cutAt = s.description.search(/\nתמונות|^תמונות/);
    if (cutAt !== -1) {
      s.description = s.description.slice(0, cutAt).trim();
    }
    // If nothing left, remove the field
    if (!s.description || s.description.length < 3) {
      delete s.description;
    }
  }

  // Fix addresses missing city suffix
  if (s.address && !s.address.includes('מעלה אדומים')) {
    s.address = `${s.address}, מעלה אדומים`;
  }

  return s;
});

fs.writeFileSync(outPath, JSON.stringify(cleaned, null, 2), 'utf8');
console.log(`Cleaned ${cleaned.length} entries`);
cleaned.forEach(s => {
  const desc = s.description ? ` | desc: ${s.description.substring(0,40)}...` : '';
  console.log(`  ${s.name} | ${s.address}${desc}`);
});
