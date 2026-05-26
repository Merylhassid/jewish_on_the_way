'use strict';

const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'gedera_synagogues.json');
const OUTPUT = path.join(__dirname, 'gedera_synagogues_clean.json');

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

const result = raw.map((item) => {
  const desc = item.description || '';

  // ── Extract synagogue name ────────────────────────────────────────────────
  // Pattern in description: "| SYNAGOGUE_NAME כתובת:" or "| SYNAGOGUE_NAMEכתובת:"
  let name = null;
  const nameMatches = [...desc.matchAll(/\|\s*([^|]+?)\s*כתובת:/g)];
  if (nameMatches.length > 0) {
    const candidate = nameMatches[nameMatches.length - 1][1].trim();
    const isGarbage = /שם הגבאי|גבאי:|נוסח:|טלפון:|מפת|פקס|מייל/.test(candidate);
    if (!isGarbage && candidate.length >= 2 && candidate.length <= 60) {
      name = candidate;
    }
  }
  // Fallback: first segment after last pipe before כתובת
  if (!name) {
    const m = desc.match(/([^\|]{2,50}?)כתובת:/);
    if (m) {
      const c = m[1].trim().replace(/^[|•\s]+/, '');
      if (c.length >= 2) name = c;
    }
  }
  if (!name) name = '(ללא שם)';

  // ── Clean address ─────────────────────────────────────────────────────────
  let address = (item.address || '')
    .replace(/שם הגבאי[\s\S]*/,  '')
    .replace(/נוסח:[\s\S]*/,     '')
    .replace(/מפת הגעה[\s\S]*/,  '')
    .replace(/שעורי תורה[\s\S]*/, '')
    .replace(/​/g, '')   // remove zero-width spaces
    .replace(/\s+/g, ' ')
    .trim();

  // ── Clean description ─────────────────────────────────────────────────────
  // Keep: נוסח, רב, גבאי, זמני תפילה — remove duplicates / noise
  const parts = desc.split('|').map((s) => s.trim()).filter(Boolean);
  const kept = [];
  const seen = new Set();
  for (const p of parts) {
    // Skip known noise
    if (/פקס:/i.test(p))       continue;
    if (/מייל:/i.test(p))       continue;
    if (/שם הגבאי:/i.test(p))   continue;
    if (/^כתובת:/i.test(p))     continue;
    if (p.includes('כתובת:'))   continue;  // any part that has full address repetition
    if (/mdgadera|bezeqint/i.test(p)) continue;
    // Deduplicate
    const key = p.replace(/\s/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(p);
  }
  const cleanDesc = kept.join(' | ').trim();

  // ── Append city name so geocoding hits the right city ────────────────────
  if (address && !address.includes('גדרה')) {
    address = `${address}, גדרה`;
  }

  // ── Build row ─────────────────────────────────────────────────────────────
  const row = {
    name,
    destinationId: 310,
  };
  if (address)   row.address     = address;
  if (item.phone) row.phone      = item.phone;
  if (cleanDesc) row.description = cleanDesc;
  // Remove Google Maps / kolhalashon — not a synagogue website

  return row;
});

fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Done — ${result.length} rows written to ${OUTPUT}`);
result.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} | ${r.address || '(no addr)'}`));
