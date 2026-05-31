const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'import-netanya-synagogues.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const cleaned = data.map(s => {
  // Clean address: remove ", Israel" suffix, fix street number order (7 מאירוביץ → מאירוביץ 7)
  let addr = s.address
    .replace(/,?\s*Israel$/i, '')
    .replace(/,?\s*ישראל$/i, '')
    .trim();

  // Fix number-before-street pattern: "7 מאירוביץ'" → "מאירוביץ' 7"
  addr = addr.replace(/^(\d+)\s+([^\d,]+?)(\s*,)/, (_, num, street, comma) => `${street.trim()} ${num}${comma}`);

  // Ensure ends with ", נתניה"
  if (!addr.includes('נתניה')) {
    addr = addr + ', נתניה';
  } else {
    // Remove duplicate city like "נתניה, נתניה"
    addr = addr.replace(/,\s*נתניה,\s*נתניה/, ', נתניה');
  }

  s.address = addr;

  // Clean phone: remove "טלפון גבאי:" prefix and whitespace
  if (s.phone) {
    s.phone = s.phone.replace(/^[^0-9+]+/, '').trim();
    if (!s.phone) delete s.phone;
  }

  // Remove empty denomination
  if (!s.denomination) delete s.denomination;

  return s;
});

fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
console.log(`Cleaned ${cleaned.length} entries`);
cleaned.slice(0, 5).forEach(s => console.log(`  ${s.name} | ${s.address} | ${s.phone || '-'}`));
