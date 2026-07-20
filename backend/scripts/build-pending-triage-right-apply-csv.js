'use strict';

/*
 * Builds an apply-ready CSV from pending-triage.csv right rows.
 * NO DB reads, NO DB writes. It only rewrites the review CSV offline so the
 * existing apply-google-shadow.js can dry-run/apply the same Google shadow
 * columns used for verified restaurants.
 *
 * Usage:
 *   node scripts/build-pending-triage-right-apply-csv.js
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'audit-output', 'pending-triage.csv');
const OUT = path.join(__dirname, '..', 'audit-output', 'pending-triage-right-920-resolved.csv');

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
  .filter((row) => row.triage === 'right')
  .sort((a, b) => Number(a.id) - Number(b.id))
  .map((row) => ({
    ...row,
    final: 'pending-triage-right',
    source: row.source || 'pending-triage',
    resolved_final: 'verified',
  }));

const header = Object.keys(rows[0] || {});
fs.writeFileSync(
  OUT,
  '\ufeff' + [header.join(','), ...rows.map((row) => header.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n',
  'utf8',
);

console.log(`Wrote ${OUT}`);
console.log({ rows: rows.length });
