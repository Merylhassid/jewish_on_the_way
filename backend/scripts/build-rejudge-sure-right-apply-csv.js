'use strict';

/*
 * Builds an apply-ready CSV from rejudge-maybe-corrected.csv sure-right rows.
 * Offline only: no DB reads, no DB writes, no Google API.
 *
 * Usage:
 *   node scripts/build-rejudge-sure-right-apply-csv.js
 *   node scripts/build-rejudge-sure-right-apply-csv.js <input.csv> <output.csv>
 */

const fs = require('fs');
const path = require('path');

const INPUT = process.argv[2] || path.join(__dirname, '..', 'audit-output', 'rejudge-maybe-corrected.csv');
const OUT = process.argv[3] || path.join(__dirname, '..', 'audit-output', 'rejudge-maybe-sure-right-157-resolved.csv');

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
  return rows
    .slice(1)
    .filter((row) => row.length >= header.length)
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ''])));
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const rows = parseCsv(INPUT)
  .filter((row) => row.bucket === 'sure_right' || (row.new_verdict === 'yes' && Number(row.new_conf || 0) >= 0.8))
  .sort((a, b) => Number(a.id) - Number(b.id))
  .map((row) => ({
    ...row,
    final: 'rejudge-maybe-sure-right',
    source: row.source || 'rejudge-maybe-corrected',
    resolved_final: 'verified',
  }));

if (!rows.length) {
  console.error('No sure-right rows found');
  process.exit(1);
}

const header = Object.keys(rows[0]);
fs.writeFileSync(
  OUT,
  '\ufeff' + [header.join(','), ...rows.map((row) => header.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n',
  'utf8',
);

console.log(`Wrote ${OUT}`);
console.log({ rows: rows.length });
