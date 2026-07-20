/*
 * DRY-RUN LLM judge — NO DB writes, NO apply, NO photos.
 * Asks Haiku whether our restaurant and Google's candidate are the SAME place,
 * using only data already in the dry-run CSV. Outputs structured verdicts for
 * manual review. Reads ANTHROPIC_API_KEY + model from .env.
 *
 * Usage: node scripts/llm-judge-dryrun.js [count]   (default 100)
 */
'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { normalizeName } = require('./lib/match-helpers');

const MODEL = process.env.SMART_SEARCH_LLM_MODEL || 'claude-haiku-4-5-20251001';
const MAX_CALLS = 120; // hard cap
const COUNT = Math.min(parseInt(process.argv[2] || '100', 10), MAX_CALLS);

// ── chain/generic hint (same heuristic as the offline analysis) ──
const BRANDS = ['ארומה', 'aroma', 'קופיקס', 'cofix', 'קפה קפה', 'פיצה האט', 'pizza hut', 'בורגר קינג',
  'burger king', 'מקדונלד', 'mcdonald', 'בורגרים', 'burgerim', 'ברמן', 'roladin', 'רולדין', 'גרג',
  'greg', 'רבר', 'rebar', 'ארקפה', 'arcaffe', 'לנדוור', 'domino', 'דומינו', 'b-fresh', 'bfresh',
  'וופל בר', 'פיצה שמש', 'שיפודי', 'בורגראנץ'];
const GENERIC = new Set(['פיצה', 'פלאפל', 'שווארמה', 'קפה', 'מסעדה', 'מסעדת', 'בר', 'מאפייה', 'סושי',
  'בורגר', 'שניצל', 'חומוס', 'גריל', 'pizza', 'falafel', 'cafe', 'bar', 'grill', 'sushi', 'burger']);
function nameType(name) {
  const norm = normalizeName(name);
  const meaningful = norm.split(' ').filter((t) => !GENERIC.has(t) && t.length >= 2);
  if (!meaningful.length) return 'generic';
  if (BRANDS.some((b) => norm.includes(b))) return 'chain';
  return 'unique';
}

const parse = (line) => {
  const o = []; let c = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === ',') { o.push(c); c = ''; } else if (ch === '"') q = true; else c += ch; }
  }
  o.push(c); return o;
};
function readCsv(f) {
  const t = fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim().split('\n');
  const hdr = t[0].split(',');
  return t.slice(1).map((l) => { const a = parse(l); return Object.fromEntries(hdr.map((h, i) => [h, a[i]])); });
}

const SYSTEM = `You decide whether two restaurant listings are the SAME physical business.
- Listing A is from our Hebrew database; listing B is a Google Places candidate.
- Names may differ only by Hebrew<->English TRANSLATION or TRANSLITERATION (e.g. "ווק טו ווק" = "Wok To Walk", "מרכז אסיה" = "Central Asia"). Treat these as the SAME name.
- Our stored coordinates/house-numbers are often wrong, so a large distance or a small house-number difference does NOT rule out a match if the street+city and name align.
- Be careful with CHAIN/brand names (many branches): answer "yes" only if the street and house number clearly match; otherwise "uncertain".
- Generic descriptive names (just "pizza", "falafel") need a clear address match; otherwise "uncertain".
- If Google's "name" is just a street address (no real business name), it is NOT a business match -> "no".
Respond with STRICT JSON only: {"same_place":"yes|no|uncertain","confidence":0.0-1.0,"reason":"short"}`;

async function judge(client, r) {
  const user = JSON.stringify({
    A_our_name: r.old_name, A_our_address: r.old_address,
    B_google_name: r.google_name, B_google_address: r.google_address,
    distance_meters: r.distance_m, name_type: nameType(r.old_name),
  });
  const resp = await client.messages.create({
    model: MODEL, max_tokens: 200,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  });
  const text = resp.content.map((c) => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { same_place: 'uncertain', confidence: 0, reason: 'unparseable: ' + text.slice(0, 80) };
  try { return JSON.parse(m[0]); } catch { return { same_place: 'uncertain', confidence: 0, reason: 'bad-json' }; }
}

(async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY');
  const client = new Anthropic({ apiKey: key });

  const all = readCsv(path.join(__dirname, '..', 'audit-output', 'dry-run-matches.csv'));
  // uncertain cases: not verified, has a google candidate, not permanently closed
  const pool = all.filter((r) => r.status !== 'verified' && r.google_name &&
    !/CLOSED/.test(r.business_status || ''));
  const sample = pool.sort(() => Math.random() - 0.5).slice(0, COUNT);
  console.log(`LLM judge (${MODEL}) over ${sample.length} uncertain cases (dry-run, no DB writes)...\n`);

  const out = [];
  const tally = { yes: 0, no: 0, uncertain: 0 };
  let n = 0;
  for (const r of sample) {
    n++;
    let v;
    try { v = await judge(client, r); } catch (e) { v = { same_place: 'uncertain', confidence: 0, reason: 'error: ' + e.message.slice(0, 60) }; }
    // enforce user's rule: chain/generic without high confidence -> uncertain
    const nt = nameType(r.old_name);
    let verdict = String(v.same_place || 'uncertain').toLowerCase();
    const conf = Number(v.confidence) || 0;
    if (verdict === 'yes' && (conf < 0.7 || ((nt === 'chain' || nt === 'generic') && conf < 0.85))) {
      verdict = 'uncertain';
    }
    tally[verdict] = (tally[verdict] || 0) + 1;
    out.push({ id: r.id, nt, our_name: r.old_name, our_addr: r.old_address, g_name: r.google_name, g_addr: r.google_address, dist: r.distance_m, verdict, confidence: conf, reason: v.reason || '' });
    if (n % 20 === 0) console.log(`  ...${n}/${sample.length}`);
    await new Promise((res) => setTimeout(res, 120));
  }

  // write CSV
  const outDir = path.join(__dirname, '..', 'audit-output');
  const file = path.join(outDir, `llm-judge-${Date.now()}.csv`);
  const esc = (s) => { const t = String(s ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const hdr = 'id,name_type,verdict,confidence,our_name,google_name,our_address,google_address,distance_m,reason';
  fs.writeFileSync(file, '﻿' + hdr + '\n' + out.map((r) => [r.id, r.nt, r.verdict, r.confidence, r.our_name, r.g_name, r.our_addr, r.g_addr, r.dist, r.reason].map(esc).join(',')).join('\n') + '\n', 'utf8');

  console.log('\n=== 100 VERDICTS (for manual review) ===');
  out.forEach((r) => console.log(
    `  [${r.verdict.toUpperCase().padEnd(9)} ${r.confidence}] #${r.id} (${r.nt}) "${r.our_name}" ~ "${r.g_name}" | ${r.dist}m\n       our:${r.our_addr}  ggl:${r.g_addr}\n       → ${r.reason}`));

  console.log('\n=== SUMMARY ===');
  console.log('judged:', out.length);
  console.log('same_place:', JSON.stringify(tally));
  console.log(`  yes (would become verified): ${tally.yes} (${(tally.yes / out.length * 100).toFixed(0)}%)`);
  console.log('CSV:', path.relative(path.join(__dirname, '..'), file));
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
