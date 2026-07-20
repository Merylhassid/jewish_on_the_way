'use strict';

/*
 * Full kosher-certification check via LLM + web search, for restaurants
 * flagged by the Shabbat-hours audit (scripts/audit-shabbat-hours.js).
 *
 * READ-ONLY — no DB writes. Produces an HTML/CSV report only.
 *
 * Usage: node scripts/audit-kosher-cert-check.js <shabbat-audit-csv>
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5-20251001';
const OUT_DIR = path.join(__dirname, '..', 'audit-output');
const RATE_MS = 300;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (q && ch === '"' && nx === '"') { cell += '"'; i++; }
    else if (ch === '"') q = !q;
    else if (!q && ch === ',') { row.push(cell); cell = ''; }
    else if (!q && (ch === '\n' || ch === '\r')) { if (ch === '\r' && nx === '\n') i++; row.push(cell); if (row.some((v) => v !== '')) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  rows[0][0] = rows[0][0].replace(/^﻿/, '');
  const header = rows[0];
  return rows.slice(1).map((v) => Object.fromEntries(header.map((h, i) => [h, v[i] ?? ''])));
}

function csvEsc(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function mapsSearch(name, address) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address || ''}`)}`; }

async function checkOne(client, r) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    system: [
      'You verify whether a SPECIFIC restaurant branch currently holds a valid kosher certification (any recognized kashrut authority — rabbanut, OU, OK, Kof-K, KLBD, local vaad, Chabad-run, etc).',
      'CRITICAL: if the restaurant is a chain with multiple locations, verify the certificate matches the EXACT city/address given, not just the brand name. A certificate for a different branch/city does NOT count as "yes" for this location — treat it as "unclear" instead and say so in evidence.',
      'Be skeptical: a restaurant serving Jewish-style food (bagels, deli, falafel, Israeli food) is NOT automatically kosher-certified. Many famous "Jewish deli" restaurants are explicitly NOT kosher.',
      'Distinguish evidence quality: an official certifying body\'s own site/PDF/certificate registry is "official". A third-party kosher-restaurant directory, travel blog, or review site is "directory" — much weaker, can be outdated or wrong.',
      'Many small international destinations (Thailand, Cyprus, Dubai, Vienna, Prague, Budapest, Morocco) have no searchable official database — the local supervision is often an informal Chabad house or community vaad with no online certificate. In that case, "unclear" is the correct honest answer — do not force a yes/no.',
      'After searching, answer in strict JSON only, no other text:',
      '{"kosher_certified":"yes"|"no"|"unclear","certifying_body":string|null,"source_quality":"official"|"directory"|"none","confidence":0-1,"evidence":"short reason in Hebrew","source_url":string|null}',
    ].join('\n'),
    messages: [{
      role: 'user',
      content: `Restaurant: "${r.name}", address: ${r.address || '(unknown)'}, ${r.dest}, ${r.country}. Does THIS specific location currently hold a valid kosher certification?`,
    }],
  });
  const textBlocks = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const match = textBlocks.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : { kosher_certified: 'unclear', certifying_body: null, source_quality: 'none', confidence: 0, evidence: 'unparseable: ' + textBlocks.slice(0, 150), source_url: null };
  const usage = resp.usage || {};
  const searchCalls = resp.content.filter((b) => b.type === 'server_tool_use' && b.name === 'web_search').length;
  return { parsed, usage, searchCalls };
}

(async () => {
  const inputCsv = process.argv[2];
  if (!inputCsv) { console.error('usage: node scripts/audit-kosher-cert-check.js <shabbat-audit-csv>'); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

  const rows = parseCsv(fs.readFileSync(inputCsv, 'utf8'));
  console.log(`loaded ${rows.length} candidates from ${inputCsv}`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results = [];
  let totalIn = 0, totalOut = 0, totalSearches = 0, errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const { parsed, usage, searchCalls } = await checkOne(client, r);
      results.push({ ...r, ...parsed });
      totalIn += usage.input_tokens || 0;
      totalOut += usage.output_tokens || 0;
      totalSearches += searchCalls;
    } catch (e) {
      results.push({ ...r, kosher_certified: 'error', certifying_body: null, source_quality: 'none', confidence: 0, evidence: e.message, source_url: null });
      errors++;
    }
    if ((i + 1) % 10 === 0 || i + 1 === rows.length) {
      const cost = (totalIn / 1e6) * 1 + (totalOut / 1e6) * 5 + (totalSearches / 1000) * 10;
      console.log(`  ${i + 1}/${rows.length} | errors=${errors} | est cost so far ~$${cost.toFixed(3)}`);
    }
    await sleep(RATE_MS);
  }

  const stamp = Date.now();
  const csvFile = path.join(OUT_DIR, `audit-kosher-cert-check-${stamp}.csv`);
  const htmlFile = path.join(OUT_DIR, `audit-kosher-cert-check-${stamp}.html`);
  const cols = ['id', 'name', 'dest', 'country', 'address', 'kosher_certified', 'source_quality', 'confidence', 'certifying_body', 'evidence', 'source_url', 'friReason', 'satReason'];
  fs.writeFileSync(csvFile, '﻿' + [cols.join(','), ...results.map((r) => cols.map((c) => csvEsc(r[c])).join(','))].join('\n') + '\n', 'utf8');

  const byNo = results.filter((r) => r.kosher_certified === 'no');
  const byUnclear = results.filter((r) => r.kosher_certified === 'unclear');
  const byYes = results.filter((r) => r.kosher_certified === 'yes');
  const byError = results.filter((r) => r.kosher_certified === 'error');

  const section = (title, color, note, items) => `
    <h2 style="color:${color}">${title} — ${items.length}</h2>
    <p class="note">${note}</p>
    <table><thead><tr><th>ID</th><th>שם</th><th>יעד</th><th>כתובת</th><th>מקור</th><th>ביטחון</th><th>נימוק</th><th>קישור</th></tr></thead><tbody>
    ${items.map((r) => `<tr>
      <td>${r.id}</td>
      <td><b>${esc(r.name)}</b></td>
      <td>${esc(r.dest)}, ${esc(r.country)}</td>
      <td>${esc(r.address)}</td>
      <td>${esc(r.certifying_body || '—')} <span class="sq sq-${esc(r.source_quality)}">${esc(r.source_quality)}</span></td>
      <td>${r.confidence}</td>
      <td class="reason">${esc(r.evidence)}</td>
      <td>${r.source_url ? `<a href="${esc(r.source_url)}" target="_blank">מקור</a>` : ''} · <a href="${esc(mapsSearch(r.name, r.address))}" target="_blank">מפות</a></td>
    </tr>`).join('')}
    </tbody></table>`;

  const totalCost = (totalIn / 1e6) * 1 + (totalOut / 1e6) * 5 + (totalSearches / 1000) * 10;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>בדיקת תעודות כשרות — LLM + חיפוש אינטרנט</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:20px}h2{font-size:16px;margin-top:26px}
.summary{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin:12px 0 20px;font-size:13.5px;line-height:1.7}
.note{font-size:12.5px;color:#607d8b;margin:4px 0 10px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:12.5px;margin-bottom:10px}
th,td{border:1px solid #e0e0e0;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#eceff1}
.reason{max-width:280px}
.sq{font-size:10px;border-radius:8px;padding:1px 6px;margin-inline-start:4px}
.sq-official{background:#e8f5e9;color:#1b5e20}
.sq-directory{background:#fff3e0;color:#e65100}
.sq-none{background:#f5f5f5;color:#757575}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body>
<h1>בדיקת תעודות כשרות — LLM + חיפוש אינטרנט</h1>
<div class="summary">
נבדקו <b>${results.length}</b> מסעדות (מועמדות משעות שבת חשודות).<br>
🔴 לא כשר (חיפוש מצא מפורשות): <b>${byNo.length}</b> · 🟠 לא ברור (בעיקר חו"ל קטן בלי מאגר רשמי): <b>${byUnclear.length}</b> · ✅ כשר מאומת: <b>${byYes.length}</b> · שגיאות: <b>${byError.length}</b><br>
עלות בפועל: ~$${totalCost.toFixed(2)} (${totalSearches} חיפושים, ${totalIn.toLocaleString()} טוקנים קלט)<br>
<b>הערה:</b> "לא ברור" זו תוצאה תקינה וצפויה לחלק גדול מחו"ל הקטן — אין שם מאגר כשרות מקוון. אלה נשארים להחלטה שלך, לא נמחקים אוטומטית.
</div>
${section('🔴 חיפוש מצא שהמסעדה לא כשרה', '#b71c1c', 'המלצה: מועמדות חזקות למחיקה — תבדוק ותאשר.', byNo)}
${section('🟠 לא ברור', '#e65100', 'רוב אלה חו"ל קטן בלי מאגר מקוון, או תעודה שלא התאימה לסניף הספציפי. צריך שיקול דעת שלך.', byUnclear)}
${section('✅ כשרות אומתה בחיפוש', '#1b5e20', 'תעודה נמצאה ומתאימה לסניף/כתובת. לא נדרשת פעולה.', byYes)}
${byError.length ? section('⚠️ שגיאות טכניות', '#6a1b9a', 'נכשלו טכנית, לא נבדקו בפועל.', byError) : ''}
</body></html>`;
  fs.writeFileSync(htmlFile, html, 'utf8');

  console.log('\n=== DONE ===');
  console.log(JSON.stringify({ total: results.length, no: byNo.length, unclear: byUnclear.length, yes: byYes.length, errors: byError.length, totalCostUsd: totalCost.toFixed(2), csvFile, htmlFile }, null, 2));
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
