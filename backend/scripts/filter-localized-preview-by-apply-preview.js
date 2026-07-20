'use strict';

/*
 * Filters a localized preview CSV to only ids that appear in an apply preview.
 * NO DB reads/writes.
 *
 * Usage:
 *   node scripts/filter-localized-preview-by-apply-preview.js <localized.csv> <apply-preview.csv> <out.csv>
 */

const fs = require('fs');
const path = require('path');

const [localizedFile, applyPreviewFile, outFile] = process.argv.slice(2);

function parseCsv(filename) {
  const text = fs.readFileSync(filename, 'utf8').replace(/^\ufeff/, '');
  const rows = [];
  let fields = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else if (ch === '\n') {
      fields.push(cur);
      rows.push(fields);
      fields = [];
      cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur || fields.length) {
    fields.push(cur);
    rows.push(fields);
  }
  const header = rows[0] || [];
  const data = rows
    .slice(1)
    .filter((row) => row.length >= header.length)
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ''])));
  return { header, data };
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

if (!localizedFile || !applyPreviewFile || !outFile) {
  console.error('usage: node scripts/filter-localized-preview-by-apply-preview.js <localized.csv> <apply-preview.csv> <out.csv>');
  process.exit(1);
}

const localizedPath = path.isAbsolute(localizedFile) ? localizedFile : path.join(__dirname, '..', localizedFile);
const applyPath = path.isAbsolute(applyPreviewFile) ? applyPreviewFile : path.join(__dirname, '..', applyPreviewFile);
const outPath = path.isAbsolute(outFile) ? outFile : path.join(__dirname, '..', outFile);

const localized = parseCsv(localizedPath);
const applyPreview = parseCsv(applyPath);
const ids = new Set(applyPreview.data.map((row) => String(row.id)));
const filtered = localized.data.filter((row) => ids.has(String(row.id)));

fs.writeFileSync(
  outPath,
  '\ufeff' + [localized.header.join(','), ...filtered.map((row) => localized.header.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n',
  'utf8',
);

console.log(`Wrote ${outPath}`);
console.log({ localizedRows: localized.data.length, applyRows: ids.size, filteredRows: filtered.length });
