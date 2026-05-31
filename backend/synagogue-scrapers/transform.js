/**
 * transform.js
 * Cleans synagogues.json → import-ready.json
 *
 * Usage:
 *   node transform.js --destinationId 340
 *   node transform.js --destinationId 340 --dry-run   (print stats only)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const destArg = args.find((a) => a.startsWith('--destinationId='))
  || args[args.indexOf('--destinationId') + 1];
const DESTINATION_ID = parseInt(destArg, 10);
const DRY_RUN = args.includes('--dry-run');

const cityIdx = args.indexOf('--city');
const CITY = cityIdx !== -1 ? args[cityIdx + 1] : null;

if (!DESTINATION_ID || isNaN(DESTINATION_ID)) {
  console.error('Usage: node transform.js --destinationId <number> [--city "עיר"] [--dry-run]');
  process.exit(1);
}

// ─── Files ────────────────────────────────────────────────────────────────────

const INPUT  = path.join(__dirname, 'synagogues.json');
const OUTPUT = path.join(__dirname, 'import-ready.json');

// ─── Address cleaner ──────────────────────────────────────────────────────────

/**
 * The scraped address field looks like:
 *   "הוסרה\nאביב הנשמה\n\nכתובת\nחזנוביץ 1"
 *
 * We want: "חזנוביץ 1"
 *
 * Strategy:
 *   1. If "כתובת" appears → take the lines after it
 *   2. Otherwise → take the last non-empty line
 *   3. Strip leading numbers/noise
 */
function cleanAddress(raw) {
  if (!raw) return null;

  // Normalize all whitespace separators → newlines
  const lines = raw
    .replace(/\t/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  // Strategy 1: look for the label "כתובת" and take what follows
  const idx = lines.findIndex((l) => l === 'כתובת');
  if (idx !== -1 && idx < lines.length - 1) {
    return lines[idx + 1].trim();
  }

  // Strategy 2: last line is usually the address
  const last = lines[lines.length - 1];

  // Sanity: reject if it looks like noise (all-English arrows, single chars, etc.)
  if (/^[←→↑↓+\-A-Za-z\s]+$/.test(last)) return null;
  if (last.length < 3) return null;

  return last;
}

// ─── Build description ────────────────────────────────────────────────────────

function buildDescription(s) {
  const parts = [];
  if (s.nusach)       parts.push(`נוסח: ${s.nusach}`);
  if (s.rabbi)        parts.push(`רב: ${s.rabbi}`);
  if (s.gabbai)       parts.push(`גבאי: ${s.gabbai}`);
  if (s.neighborhood) parts.push(`שכונה: ${s.neighborhood}`);
  if (s.city)         parts.push(`עיר: ${s.city}`);
  if (s.hours)        parts.push(`שעות תפילה: ${s.hours}`);
  if (s.notes)        parts.push(s.notes);
  return parts.length ? parts.join(' | ') : null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const synagogues = raw.synagogues || [];

let kept = 0;
let skippedNonSynagogue = 0;
let skippedNoName = 0;
const seenNames = new Set();
const results = [];

for (const s of synagogues) {
  // ── Filter 1: must be a real synagogue URL (not a misc page)
  if (!s.url || !s.url.includes('/synagogue/')) {
    skippedNonSynagogue++;
    continue;
  }

  // ── Filter 2: must have a name
  if (!s.name || s.name.trim().length < 2) {
    skippedNoName++;
    continue;
  }

  const name = s.name.trim();

  // ── Filter 3: deduplicate by name
  if (seenNames.has(name)) continue;
  seenNames.add(name);

  const rawAddress  = cleanAddress(s.address);
  const address     = rawAddress && CITY ? `${rawAddress}, ${CITY}` : rawAddress;
  const description = buildDescription(s);

  const row = {
    name,
    destinationId: DESTINATION_ID,
  };

  if (address)     row.address     = address;
  if (s.phone)     row.phone       = s.phone.trim();
  if (s.nusach)    row.denomination = s.nusach.trim();
  if (s.url)       row.website     = s.url;
  if (description) row.description = description;

  results.push(row);
  kept++;
}

// ─── Output ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────');
console.log(`  Transform Results`);
console.log('─────────────────────────────────');
console.log(`Total in input:        ${synagogues.length}`);
console.log(`Skipped (not synagogue): ${skippedNonSynagogue}`);
console.log(`Skipped (no name):       ${skippedNoName}`);
console.log(`Kept (unique):           ${kept}`);
console.log(`destinationId:           ${DESTINATION_ID}`);
console.log(`City appended:           ${CITY ?? '(none)'}`);
console.log('─────────────────────────────────\n');

if (!DRY_RUN) {
  fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`✓ Saved: ${OUTPUT}`);
  console.log(`\nNext step:`);
  console.log(`  .\\import-rabanut.ps1 -Email "your@email.com" -Password "yourpass"\n`);
} else {
  console.log('Dry run — first 3 records:');
  console.log(JSON.stringify(results.slice(0, 3), null, 2));
}
