const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'import-netivot-synagogues.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const cleaned = data
  .filter(s => !s.name.includes('פתרונות') && !s.name.includes('תזמון'))
  .map(s => {
    s.name = s.name.replace(/\s+/g, ' ').trim();
    if (!s.phone) delete s.phone;
    return s;
  });

fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
console.log(`Cleaned: ${data.length} → ${cleaned.length} entries`);
cleaned.slice(0, 5).forEach(s => console.log(`  ${s.name} | ${s.address} | ${s.phone || '-'}`));
