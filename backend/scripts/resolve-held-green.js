/*
 * STEP 1 — resolve the ~196 held-back green-triage rows (place_id collisions).
 * For each held row, score it against the CURRENT DB owner of that place_id:
 * who matches the Google business better (name + street + house + city)?
 *   owner_wins  -> held row's candidate was the wrong business -> Phase B pool.
 *   held_wins   -> swap candidate (REPORT ONLY — modifying an applied row needs approval).
 *   ambiguous   -> manual review.
 * In-set duplicates (held rows sharing a place_id, no DB owner): winner -> apply
 * list, losers -> Phase B pool.
 * READ-ONLY on DB. Outputs: held-green-resolution.{html,csv} + held-green-apply.csv.
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { nameSimilarity } = require('./lib/match-helpers');
const { classifyAddressFirst } = require('./lib/address-match');

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

// score how well (name,address) matches the google (gName,gAddr)
function fitScore(name, address, gName, gAddr) {
  const sim = nameSimilarity(name, gName);
  const af = classifyAddressFirst({
    old_name: name, old_address: address, google_name: gName, google_address: gAddr,
    name_sim: sim, business_status: 'OPERATIONAL', google_rating: '4', google_phone: 'x', has_photo: 'yes', distance_m: '',
  });
  const addr = af.addressExact ? 3 : (af.streetMatch && af.cityMatch) ? 2 : af.cityMatch ? 1 : 0;
  return { score: addr * 10 + sim * 6, sim, addr };
}

(async () => {
  const rows = parseCsv(path.join(__dirname, '..', 'audit-output', 'pending-triage.csv'));
  const H = rows[0];
  const data = rows.slice(1).filter((r) => r.length >= H.length).map((a) => Object.fromEntries(H.map((h, i) => [h, a[i]])));
  const green = data.filter((r) => r.triage === 'right');

  const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT || 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await c.connect();
  const ids = green.map((r) => Number(r.id));
  const db = (await c.query('select id,verification_status from restaurants where id=ANY($1)', [ids])).rows;
  const statusById = new Map(db.map((r) => [Number(r.id), r.verification_status]));
  const held = green.filter((r) => statusById.get(Number(r.id)) !== 'verified');

  const pids = [...new Set(held.map((r) => r.google_place_id).filter(Boolean))];
  const owners = (await c.query(
    `select id,name,address,google_place_id,google_display_name,google_formatted_address
       from restaurants where google_place_id=ANY($1)`, [pids],
  )).rows;
  await c.end();
  const ownerByPid = new Map(owners.map((o) => [o.google_place_id, o]));

  const MARGIN = 4; // score gap needed for a clear win
  const buckets = { owner_wins: [], held_wins: [], ambiguous: [], apply: [], inset_loser: [] };

  // group held by pid for in-set handling
  const byPid = {};
  held.forEach((r) => (byPid[r.google_place_id] = byPid[r.google_place_id] || []).push(r));

  for (const [pid, group] of Object.entries(byPid)) {
    const owner = ownerByPid.get(pid);
    const scored = group.map((r) => ({ r, ...fitScore(r.old_name, r.old_address, r.google_name, r.google_address) }))
      .sort((a, b) => b.score - a.score);
    if (owner && !group.some((g) => Number(g.id) === Number(owner.id))) {
      // DB owner conflict: compare best held vs owner
      const o = fitScore(owner.name, owner.address, owner.google_display_name || scored[0].r.google_name, owner.google_formatted_address || scored[0].r.google_address);
      const best = scored[0];
      const diff = best.score - o.score;
      const rec = { pid, owner, ownerScore: o, best, rest: scored.slice(1) };
      if (diff <= -MARGIN || (o.addr >= 2 && best.addr === 0)) buckets.owner_wins.push(rec);
      else if (diff >= MARGIN) buckets.held_wins.push(rec);
      else buckets.ambiguous.push(rec);
      scored.slice(1).forEach((s) => buckets.inset_loser.push({ pid, r: s.r }));
    } else {
      // no DB owner (pure in-set dup): winner is appliable, losers -> Phase B
      buckets.apply.push(scored[0]);
      scored.slice(1).forEach((s) => buckets.inset_loser.push({ pid, r: s.r }));
    }
  }

  // winners-apply CSV in the resolved format (for apply-google-shadow.js)
  const applyCsv = path.join(__dirname, '..', 'audit-output', 'held-green-apply.csv');
  const out = [H.join(',')];
  for (const { r } of buckets.apply) {
    const row = { ...r, final: 'verified', resolved_final: 'verified', source: 'triage-green-dedup' };
    out.push(H.map((h) => csvEsc(row[h])).join(','));
  }
  fs.writeFileSync(applyCsv, '﻿' + out.join('\n') + '\n', 'utf8');

  // report CSV
  const repCsv = path.join(__dirname, '..', 'audit-output', 'held-green-resolution.csv');
  const rep = [['outcome', 'held_id', 'held_name', 'held_address', 'held_score', 'owner_id', 'owner_name', 'owner_address', 'owner_score', 'google_name', 'google_address', 'place_id'].join(',')];
  const push = (outcome, rec) => rep.push([outcome, rec.best.r.id, rec.best.r.old_name, rec.best.r.old_address, rec.best.score.toFixed(1),
    rec.owner.id, rec.owner.name, rec.owner.address, rec.ownerScore.score.toFixed(1),
    rec.best.r.google_name, rec.best.r.google_address, rec.pid].map(csvEsc).join(','));
  buckets.owner_wins.forEach((x) => push('owner_wins', x));
  buckets.held_wins.forEach((x) => push('held_wins_SWAP_NEEDED', x));
  buckets.ambiguous.forEach((x) => push('ambiguous', x));
  buckets.apply.forEach((x) => rep.push(['apply_clean', x.r.id, x.r.old_name, x.r.old_address, x.score.toFixed(1), '', '', '', '', x.r.google_name, x.r.google_address, x.r.google_place_id].map(csvEsc).join(',')));
  buckets.inset_loser.forEach((x) => rep.push(['inset_loser_to_phaseB', x.r.id, x.r.old_name, x.r.old_address, '', '', '', '', '', x.r.google_name, x.r.google_address, x.pid].map(csvEsc).join(',')));
  fs.writeFileSync(repCsv, '﻿' + rep.join('\n') + '\n', 'utf8');

  // HTML report
  const sec = (title, color, rowsHtml, note) =>
    `<h2 style="color:${color}">${title}</h2><p class="note">${note}</p><table><thead><tr>
     <th>held id</th><th>שם (תקועה)</th><th>כתובת</th><th>ציון</th><th>owner id</th><th>שם (ב-DB)</th><th>כתובת</th><th>ציון</th><th>גוגל</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
  const row = (rec) => `<tr><td>${esc(rec.best.r.id)}</td><td><b>${esc(rec.best.r.old_name)}</b></td><td>${esc(rec.best.r.old_address)}</td><td>${rec.best.score.toFixed(1)}</td>
    <td>${esc(rec.owner.id)}</td><td><b>${esc(rec.owner.name)}</b></td><td>${esc(rec.owner.address)}</td><td>${rec.ownerScore.score.toFixed(1)}</td>
    <td>${esc(rec.best.r.google_name)}<br><small>${esc(rec.best.r.google_address)}</small></td></tr>`;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>הכרעת 196 התקועות</title>
<style>body{font-family:Arial;margin:16px;background:#fafafa}h1{font-size:18px}h2{font-size:15px;margin:22px 0 4px}
.note{font-size:12px;color:#666;margin:0 0 6px}table{border-collapse:collapse;width:100%;font-size:12px;background:#fff}
th,td{border:1px solid #e0e0e0;padding:4px 7px;text-align:right;vertical-align:top}th{background:#eceff1}
tr:nth-child(even){background:#f7f9fa}</style></head><body>
<h1>הכרעת ${held.length} הירוקות התקועות (התנגשויות place_id)</h1>
<p>בעלים ב-DB ניצח: ${buckets.owner_wins.length} · תקועה ניצחה (דורש swap): ${buckets.held_wins.length} · לא חד-משמעי: ${buckets.ambiguous.length} · נקיות להחלה: ${buckets.apply.length} · מפסידות פנימיות: ${buckets.inset_loser.length}</p>
${sec(`🏆 הבעלים ב-DB ניצח (${buckets.owner_wins.length}) — התקועה מקבלת חיפוש מחדש ב-B`, '#455a64', buckets.owner_wins.map(row).join(''), 'ההתאמה הקיימת ב-DB טובה יותר; המועמד של התקועה היה שגוי.')}
${sec(`🔄 התקועה מתאימה יותר (${buckets.held_wins.length}) — דורש החלפה, לא בוצע!`, '#b71c1c', buckets.held_wins.map(row).join(''), 'ההתאמה של התקועה חזקה יותר מהשורה שכבר ב-DB. החלפה משנה שורה קיימת — ממתין לאישורך.')}
${sec(`❓ לא חד-משמעי (${buckets.ambiguous.length})`, '#e65100', buckets.ambiguous.map(row).join(''), 'הפרש ציונים קטן — כנראה כפילות אמיתית ב-DB (אותה מסעדה פעמיים). לבדיקה ידנית.')}
</body></html>`;
  fs.writeFileSync(path.join(__dirname, '..', 'audit-output', 'held-green-resolution.html'), html, 'utf8');

  console.log('=== HELD-GREEN RESOLUTION (read-only) ===');
  console.log(`held rows analyzed: ${held.length} (${Object.keys(byPid).length} place_ids)`);
  console.log(`🏆 owner_wins (held -> Phase B): ${buckets.owner_wins.length}`);
  console.log(`🔄 held_wins (swap needed, NOT executed): ${buckets.held_wins.length}`);
  console.log(`❓ ambiguous (likely true DB duplicates): ${buckets.ambiguous.length}`);
  console.log(`✅ apply-clean (in-set winners, no DB owner): ${buckets.apply.length}`);
  console.log(`↩ in-set losers -> Phase B: ${buckets.inset_loser.length}`);
  console.log('HTML: audit-output/held-green-resolution.html');
  console.log('CSV : audit-output/held-green-resolution.csv');
  console.log('apply file: audit-output/held-green-apply.csv');
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
