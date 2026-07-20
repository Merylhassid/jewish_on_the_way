/*
 * PILOT B — completion pass: LLM-judge the still_maybe rows from pilot-b.csv.
 * Data already fetched from Google (paid) — this is offline: NO Google calls,
 * NO DB writes. Rewrites pilot-b-final.{csv,html} with the completed picture.
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { nameType } = require('./lib/address-match');

const MODEL = process.env.SMART_SEARCH_LLM_MODEL || 'claude-haiku-4-5-20251001';
const LLM_IN = 1 / 1e6, LLM_OUT = 5 / 1e6, MAX_USD = 0.8;

const SYSTEM = `You decide whether two restaurant listings are the SAME physical business.
A = our DB (often imprecise); B = a Google candidate found by a clean name+city re-search (authoritative).
- Hebrew<->English translation/transliteration = SAME name.
- Our address may be wrong; if the unique name clearly matches and the city fits, answer yes.
- Chains: different street in same city = different branch -> no. Generic names need address support.
- If B is not a food business or unrelated, answer no.
STRICT JSON: {"same_place":"yes|no|uncertain","confidence":0.0-1.0,"reason":"short Hebrew"}`;

function parseCsv(f) {
  const s = fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
  const rows = []; let ff = [], c = '', q = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { ff.push(c); c = ''; }
    else if (ch === '\n') { ff.push(c); rows.push(ff); ff = []; c = ''; }
    else if (ch !== '\r') c += ch; }
  if (c || ff.length) { ff.push(c); rows.push(ff); }
  return rows;
}
const csvEsc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

(async () => {
  const src = path.join(__dirname, '..', 'audit-output', 'pilot-b.csv');
  const rows = parseCsv(src);
  const H = rows[0];
  const data = rows.slice(1).filter((r) => r.length >= H.length).map((a) => Object.fromEntries(H.map((h, i) => [h, a[i]])));
  const targets = data.filter((r) => r.group === 'still_maybe' && r.new_google_name);
  console.log(`\n=== PILOT B COMPLETION — LLM on ${targets.length} borderline rows (no Google) ===\n`);

  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let usd = 0, calls = 0, up = 0, down = 0, kept = 0;

  for (const r of targets) {
    if (usd >= MAX_USD) { console.log('[budget] cap'); break; }
    try {
      const resp = await llm.messages.create({
        model: MODEL, max_tokens: 180, system: SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify({
          A: { name: r.old_name, address: r.old_address },
          B: { name: r.new_google_name, address: r.new_google_address },
          name_type: nameType(r.old_name),
        }) }],
      });
      calls++;
      usd += (resp.usage?.input_tokens || 0) * LLM_IN + (resp.usage?.output_tokens || 0) * LLM_OUT;
      const m = resp.content.map((c) => c.text || '').join('').match(/\{[\s\S]*\}/);
      const v = m ? JSON.parse(m[0]) : { same_place: 'uncertain', confidence: 0 };
      const conf = Number(v.confidence) || 0;
      const verdict = String(v.same_place || 'uncertain').toLowerCase();
      const reason = (v.reason || '').replace(/[\r\n]+/g, ' ');
      if (verdict === 'yes' && conf >= 0.85) { r.group = 'sure_right'; r.reason = `LLM אישר (${conf}): ${reason}`; up++; }
      else if (verdict === 'no' && conf >= 0.85) { r.group = 'wrong_or_notfound'; r.reason = `LLM דחה (${conf}): ${reason}`; down++; }
      else { r.reason = `LLM לא הכריע (${conf}): ${reason}`; kept++; }
    } catch (e) { kept++; }
    if ((up + down + kept) % 15 === 0) console.log(`  ...${up + down + kept}/${targets.length} up=${up} down=${down} kept=${kept} $${usd.toFixed(3)}`);
  }

  const tally = { sure_right: 0, wrong_or_notfound: 0, still_maybe: 0 };
  data.forEach((r) => tally[r.group] = (tally[r.group] || 0) + 1);

  const outCsv = path.join(__dirname, '..', 'audit-output', 'pilot-b-final.csv');
  fs.writeFileSync(outCsv, '﻿' + H.join(',') + '\n' + data.map((r) => H.map((h) => csvEsc(r[h])).join(',')).join('\n') + '\n', 'utf8');

  const mapsQ = (r) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${r.old_name} ${r.old_address || ''}`);
  const pinQ = (pid) => pid ? `https://www.google.com/maps/place/?q=place_id:${pid}` : '';
  const sec = (title, color, items, note) => `<h2 style="color:${color}">${title} — ${items.length}</h2><p class="note">${note}</p>
<table><thead><tr><th>id</th><th>pool</th><th>השם שלנו</th><th>כתובת שלנו</th><th>גוגל מצא</th><th>כתובת גוגל</th><th>נימוק</th><th>קישורים</th></tr></thead><tbody>` +
    items.map((x) => `<tr><td>${esc(x.id)}</td><td>${esc(x.pool)}</td><td><b>${esc(x.old_name)}</b></td><td>${esc(x.old_address)}</td>
<td>${esc(x.new_google_name || '—')}</td><td>${esc(x.new_google_address || '')}</td><td class="why">${esc(x.reason)}</td>
<td><a href="${esc(mapsQ(x))}" target="_blank">שלנו</a>${x.new_place_id ? ` · <a href="${esc(pinQ(x.new_place_id))}" target="_blank">פין גוגל</a>` : ''}</td></tr>`).join('') + '</tbody></table>';
  const g = (n) => data.filter((x) => x.group === n);
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>פיילוט B — סופי</title>
<style>body{font-family:Arial;margin:16px;background:#fafafa}h1{font-size:18px}h2{font-size:15px;margin:22px 0 4px}
.note{font-size:12px;color:#666;margin:0 0 6px}.sum{font-size:13px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px 14px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:12px;background:#fff}th,td{border:1px solid #e0e0e0;padding:4px 7px;text-align:right;vertical-align:top}
th{background:#eceff1}tr:nth-child(even){background:#f7f9fa}td.why{max-width:280px;color:#455a64}a{color:#1565c0}</style></head><body>
<h1>פיילוט B — תוצאה סופית (אחרי השלמת LLM)</h1>
<div class="sum">✅ בטוח נכון: <b>${tally.sure_right}</b> · ❌ לא נכון/לא נמצא: <b>${tally.wrong_or_notfound}</b> · ❓ עדיין אולי: <b>${tally.still_maybe}</b></div>
${sec('✅ בטוח נכון', '#1b5e20', g('sure_right'), 'חוקים + LLM. מוכנים ל-apply אחרי אישורך.')}
${sec('❓ עדיין אולי', '#e65100', g('still_maybe'), 'לא הוכרעו גם עם LLM — בדיקה ידנית.')}
${sec('❌ לא נכון / לא נמצא', '#b71c1c', g('wrong_or_notfound'), 'אין התאמה אמיתית בגוגל — כנראה סגורות/לא קיימות.')}
</body></html>`;
  fs.writeFileSync(path.join(__dirname, '..', 'audit-output', 'pilot-b-final.html'), html, 'utf8');

  console.log('\n=== PILOT B FINAL ===');
  console.log(`LLM judged: ${calls} | promoted: ${up} | rejected: ${down} | kept maybe: ${kept} | cost $${usd.toFixed(3)}`);
  console.log(`FINAL: ✅ ${tally.sure_right} | ❌ ${tally.wrong_or_notfound} | ❓ ${tally.still_maybe}`);
  console.log('CSV : audit-output/pilot-b-final.csv');
  console.log('HTML: audit-output/pilot-b-final.html');
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
