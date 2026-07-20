/*
 * TARGETED B RUN (Option A) — re-search WITHOUT locationBias, only on the
 * pools that converted well in the pilot:
 *   - ALL a-maybe (Phase-A still_maybe)
 *   - ALL no-cand (never had a candidate)
 *   - red triage rows with a UNIQUE (strong) name only
 *   - EXCLUDES: a-wrong (7% conversion), rows already handled in the pilot.
 * NO DB writes, NO photos, NO apply. Minimal-mask Details for NEW ids only.
 * Persistent disk cache (details-cache.json) so nothing is ever paid twice.
 * Incremental CSV append. Outputs targeted-b.{csv,html} + cost accounting.
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { GooglePlaces } = require('./lib/google-places');
const { nameSimilarity, normalizeName } = require('./lib/match-helpers');
const { classifyAddressFirst, nameType, ourCity } = require('./lib/address-match');

const MAX_TS = 3000, MAX_DETAILS = 2500, MAX_LLM_USD = 2.0;
const MIN_MASK = 'id,displayName,formattedAddress,location,businessStatus,types,primaryType';
const DETAILS_MIN_USD = 0.017;
const MODEL = process.env.SMART_SEARCH_LLM_MODEL || 'claude-haiku-4-5-20251001';
const LLM_IN = 1 / 1e6, LLM_OUT = 5 / 1e6;
const outDir = path.join(__dirname, '..', 'audit-output');
const CACHE_FILE = path.join(outDir, 'details-cache.json');

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
const toObjs = (rows) => { const H = rows[0]; return rows.slice(1).filter((r) => r.length >= H.length).map((a) => Object.fromEntries(H.map((h, i) => [h, a[i]]))); };
const csvEsc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

const GENERIC_WORDS = /\b(מסעדת|מסעדה|פיצה|פיצריה|שווארמה|פלאפל|חומוס|קפה|מאפיית|מאפייה|בורגר|סושי|גריל|שיפודי|בר|ביסטרו|restaurant|pizza|cafe|falafel|shawarma|burger|sushi|grill|bakery)\b/gi;
const NONFOOD_RE = /shopping_mall|clinic|doctor|hospital|dental|gym|fitness|lodging|hotel|pharmacy|school|university|bank|gas_station|parking|car_|store$|real_estate|government|beauty_salon/;
const ADDRESS_AS_NAME_RE = /(^\d+\s)|(\b(st|street|rd|road|blvd|ave|sderot|derech)\.?\s+\d+)|(^[A-Za-z\-'. ]+\s+St\b)/i;
const streetOf = (addr) => normalizeName((addr || '').split(',')[0] || '').replace(/\d+/g, '').trim();

function judgeCandidate(row, cand) {
  const sim = nameSimilarity(row.old_name, cand.name);
  const nt = nameType(row.old_name);
  const af = classifyAddressFirst({
    old_name: row.old_name, old_address: row.old_address, google_name: cand.name,
    google_address: cand.address, name_sim: sim, business_status: cand.status || 'OPERATIONAL',
    google_rating: '4', google_phone: 'x', has_photo: 'yes', distance_m: '',
  });
  const contains = sim >= 0.99 || (normalizeName(cand.name).includes(normalizeName(row.old_name)) && normalizeName(row.old_name).length >= 4);
  const addrScore = af.addressExact ? 3 : (af.streetMatch && af.cityMatch) ? 2 : af.cityMatch ? 1 : 0;
  const score = addrScore * 10 + sim * 6 + (cand.variants >= 2 ? 2 : 0);
  if (cand.types && NONFOOD_RE.test(cand.types)) return { verdict: 'reject', score: -1, why: 'לא-מזון' };
  if (ADDRESS_AS_NAME_RE.test(cand.name) && sim < 0.4) return { verdict: 'reject', score: -1, why: 'כתובת-בתור-שם' };
  if (cand.status && cand.status !== 'OPERATIONAL' && sim < 0.7) return { verdict: 'reject', score: -1, why: 'סגור' };
  if (nt === 'unique' && (sim >= 0.75 || contains) && af.cityMatch) return { verdict: 'yes', score, why: `שם ייחודי תואם (sim ${sim.toFixed(2)}) + עיר` };
  if ((sim >= 0.5 || contains) && af.cityMatch && af.streetMatch && nt !== 'chain') return { verdict: 'yes', score, why: 'שם תואם + עיר + רחוב' };
  if (nt === 'chain' && (sim >= 0.75 || contains) && af.streetMatch && af.cityMatch) return { verdict: 'yes', score, why: 'רשת — רחוב תואם (אותו סניף)' };
  if (nt === 'chain' && (sim >= 0.75 || contains)) return { verdict: 'borderline', score, why: 'רשת, רחוב לא אומת' };
  if (nt === 'generic' && af.addressExact) return { verdict: 'yes', score, why: 'שם גנרי, כתובת מדויקת' };
  if (sim >= 0.4 || contains || addrScore >= 2) return { verdict: 'borderline', score, why: `סימנים חלקיים (sim ${sim.toFixed(2)}, addr ${addrScore})` };
  return { verdict: 'reject', score, why: `אין התאמה (sim ${sim.toFixed(2)})` };
}

(async () => {
  // ── build target list ──
  const triage = toObjs(parseCsv(path.join(outDir, 'pending-triage.csv')));
  const rejudge = toObjs(parseCsv(path.join(outDir, 'rejudge-maybe-corrected.csv')));
  const resolved = toObjs(parseCsv(path.join(outDir, 'combined-dryrun-1783240537425-resolved.csv')));
  const pilotIds = new Set(toObjs(parseCsv(path.join(outDir, 'pilot-b-final.csv'))).map((r) => r.id));

  const aMaybe = rejudge.filter((r) => r.bucket === 'still_maybe' && !pilotIds.has(r.id)).map((r) => ({ ...r, pool: 'a-maybe' }));
  const noCand = resolved.filter((r) => (r.resolved_final || r.final) !== 'verified' && (r.resolved_final || r.final) !== 'error' && !r.google_name && !pilotIds.has(r.id)).map((r) => ({ ...r, pool: 'no-cand' }));
  const redUnique = triage.filter((r) => r.triage === 'wrong' && !pilotIds.has(r.id)
    && nameType(r.old_name) === 'unique'
    && normalizeName(r.old_name).replace(/[^\p{L}]/gu, '').length >= 4).map((r) => ({ ...r, pool: 'red-unique' }));
  const targets = [...aMaybe, ...noCand, ...redUnique];
  console.log(`\n=== TARGETED B RUN — ${targets.length} rows (a-maybe ${aMaybe.length} / no-cand ${noCand.length} / red-unique ${redUnique.length}) ===`);
  console.log('NO locationBias · NO DB writes · minimal Details for NEW ids only\n');

  // ── caches: resolved CSV (enterprise data) + persistent disk cache ──
  const cache = new Map();
  for (const r of resolved) if (r.google_place_id) cache.set(r.google_place_id, {
    name: r.google_name, address: r.google_address, status: r.business_status,
    types: r.google_types || r.google_primary_type || '',
  });
  let disk = {};
  try { disk = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch {}
  for (const [pid, d] of Object.entries(disk)) if (!cache.has(pid)) cache.set(pid, d);
  console.log(`details cache: ${cache.size} place_ids loaded (resolved CSV + disk)\n`);
  let diskDirty = 0;
  const saveDisk = () => { fs.writeFileSync(CACHE_FILE, JSON.stringify(disk), 'utf8'); diskDirty = 0; };

  const gp = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 120 });
  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let llmDead = false, llmUsd = 0, llmCalls = 0, cacheHits = 0, newIds = 0;
  const tally = { sure_right: 0, wrong_or_notfound: 0, still_maybe: 0 };

  const csvF = path.join(outDir, 'targeted-b.csv');
  const COLS = ['group', 'pool', 'id', 'old_name', 'old_address', 'new_google_name', 'new_google_address', 'new_place_id', 'reason'];
  fs.writeFileSync(csvF, '﻿' + COLS.join(',') + '\n', 'utf8');
  const results = [];

  for (const row of targets) {
    if (gp.calls.textSearch >= MAX_TS || gp.calls.details >= MAX_DETAILS) { console.log('[budget] Google cap reached'); break; }
    const city = ourCity(row.old_address) || '';
    const cleaned = normalizeName(row.old_name).replace(GENERIC_WORDS, '').replace(/\s+/g, ' ').trim();
    const street = streetOf(row.old_address);
    const oldPid = row.google_place_id || '';
    const variants = [
      `${row.old_name} ${city}`.trim(),
      cleaned && cleaned !== normalizeName(row.old_name) ? `${cleaned} ${city}`.trim() : null,
      street ? `${row.old_name} ${street}` : null,
    ].filter(Boolean);

    const found = new Map();
    for (const q of variants) {
      try { (await gp.searchIds(q, { max: 5 })).forEach((pid) => found.set(pid, (found.get(pid) || 0) + 1)); } catch {}
    }
    if (oldPid && found.has(oldPid) && found.get(oldPid) < 2) found.delete(oldPid);

    const cands = [];
    for (const [pid, nVar] of [...found.entries()].slice(0, 6)) {
      let d = cache.get(pid);
      if (d) cacheHits++;
      else {
        if (gp.calls.details >= MAX_DETAILS) break;
        try {
          const raw = await gp.getDetails(pid, { mask: MIN_MASK });
          d = { name: raw.displayName?.text || '', address: raw.formattedAddress || '', status: raw.businessStatus || '', types: (raw.types || []).join(';') };
          cache.set(pid, d); disk[pid] = d; newIds++; diskDirty++;
          if (diskDirty >= 50) saveDisk();
        } catch { continue; }
      }
      cands.push({ pid, variants: nVar, ...d });
    }

    let best = null;
    for (const cand of cands) { const j = judgeCandidate(row, cand); if (!best || j.score > best.j.score) best = { cand, j }; }

    let group, why, gName = '', gAddr = '', pid = '';
    if (!best || best.j.verdict === 'reject') {
      group = 'wrong_or_notfound';
      why = cands.length ? `נבדקו ${cands.length} מועמדים — אין התאמה` : 'גוגל לא החזיר מועמדים';
    } else {
      gName = best.cand.name; gAddr = best.cand.address; pid = best.cand.pid;
      if (best.j.verdict === 'yes') { group = 'sure_right'; why = best.j.why + (pid === oldPid ? ' · המועמד הישן חזר בראיה חזקה' : ''); }
      else if (!llmDead && llmUsd < MAX_LLM_USD) {
        try {
          const resp = await llm.messages.create({
            model: MODEL, max_tokens: 180,
            system: 'Same physical restaurant? Hebrew<->English translation/transliteration = same name. Our address may be wrong; Google is right. Chains: different street = different branch = no. Generic names need address support. JSON only: {"same_place":"yes|no|uncertain","confidence":0-1,"reason":"short Hebrew"}',
            messages: [{ role: 'user', content: JSON.stringify({ A: { name: row.old_name, address: row.old_address }, B: { name: gName, address: gAddr }, name_type: nameType(row.old_name) }) }],
          });
          llmCalls++;
          llmUsd += (resp.usage?.input_tokens || 0) * LLM_IN + (resp.usage?.output_tokens || 0) * LLM_OUT;
          const m = resp.content.map((c) => c.text || '').join('').match(/\{[\s\S]*\}/);
          const v = m ? JSON.parse(m[0]) : { same_place: 'uncertain', confidence: 0 };
          const conf = Number(v.confidence) || 0, vd = String(v.same_place).toLowerCase();
          if (vd === 'yes' && conf >= 0.85) { group = 'sure_right'; why = `LLM אישר (${conf}): ${v.reason || ''}`; }
          else if (vd === 'no' && conf >= 0.85) { group = 'wrong_or_notfound'; why = `LLM דחה (${conf}): ${v.reason || ''}`; }
          else { group = 'still_maybe'; why = `LLM לא הכריע: ${v.reason || best.j.why}`; }
        } catch (e) {
          if (/credit|billing/i.test(e.message)) llmDead = true;
          group = 'still_maybe'; why = best.j.why + ' · [LLM שגיאה]';
        }
      } else { group = 'still_maybe'; why = best.j.why + (llmDead ? ' · [LLM לא זמין]' : ''); }
    }
    tally[group]++;
    results.push({ row, group, gName, gAddr, pid, why });
    fs.appendFileSync(csvF, [group, row.pool, row.id, row.old_name, row.old_address, gName, gAddr, pid, why].map(csvEsc).join(',') + '\n', 'utf8');
    if (results.length % 50 === 0) console.log(`  ...${results.length}/${targets.length}  right=${tally.sure_right} wrong/nf=${tally.wrong_or_notfound} maybe=${tally.still_maybe}  TS=${gp.calls.textSearch} newD=${newIds} cache=${cacheHits}  G$${(newIds * DETAILS_MIN_USD).toFixed(2)} A$${llmUsd.toFixed(2)}`);
  }
  saveDisk();

  // HTML
  const mapsQ = (r) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${r.old_name} ${r.old_address || ''}`);
  const pinQ = (pid) => pid ? `https://www.google.com/maps/place/?q=place_id:${pid}` : '';
  const sec = (title, color, items, note) => `<h2 style="color:${color}">${title} — ${items.length}</h2><p class="note">${note}</p>
<table><thead><tr><th>id</th><th>pool</th><th>השם שלנו</th><th>כתובת שלנו</th><th>גוגל מצא</th><th>כתובת גוגל</th><th>נימוק</th><th>קישורים</th></tr></thead><tbody>` +
    items.map((x) => `<tr><td>${esc(x.row.id)}</td><td>${esc(x.row.pool)}</td><td><b>${esc(x.row.old_name)}</b></td><td>${esc(x.row.old_address)}</td>
<td>${esc(x.gName || '—')}</td><td>${esc(x.gAddr || '')}</td><td class="why">${esc(x.why)}</td>
<td><a href="${esc(mapsQ(x.row))}" target="_blank">שלנו</a>${x.pid ? ` · <a href="${esc(pinQ(x.pid))}" target="_blank">פין גוגל</a>` : ''}</td></tr>`).join('') + '</tbody></table>';
  const g = (n) => results.filter((x) => x.group === n);
  const costG = (newIds * DETAILS_MIN_USD).toFixed(2);
  fs.writeFileSync(path.join(outDir, 'targeted-b.html'), `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>ריצה ממוקדת B</title>
<style>body{font-family:Arial;margin:16px;background:#fafafa}h1{font-size:18px}h2{font-size:15px;margin:22px 0 4px}
.note{font-size:12px;color:#666;margin:0 0 6px}.sum{font-size:13px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px 14px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:12px;background:#fff}th,td{border:1px solid #e0e0e0;padding:4px 7px;text-align:right;vertical-align:top}
th{background:#eceff1}tr:nth-child(even){background:#f7f9fa}td.why{max-width:280px;color:#455a64}a{color:#1565c0}</style></head><body>
<h1>ריצה ממוקדת B — ${results.length} מסעדות (a-maybe / no-cand / red-unique)</h1>
<div class="sum">✅ בטוח נכון: <b>${tally.sure_right}</b> · ❌ לא נכון/לא נמצא: <b>${tally.wrong_or_notfound}</b> · ❓ עדיין אולי: <b>${tally.still_maybe}</b><br>
TS: ${gp.calls.textSearch} (IDs-only, $0) · Details חדשים: ${newIds} (~$${costG}) · cache hits: ${cacheHits} · Anthropic: $${llmUsd.toFixed(2)} (${llmCalls})</div>
${sec('✅ בטוח נכון', '#1b5e20', g('sure_right'), 'מוכנות ל-apply אחרי אישורך (יקבלו Details מלא בשלב ה-apply).')}
${sec('❓ עדיין אולי', '#e65100', g('still_maybe'), 'לא הוכרע — בדיקה ידנית.')}
${sec('❌ לא נכון / לא נמצא', '#b71c1c', g('wrong_or_notfound'), 'גם חיפוש נקי לא מצא — יסומנו not_on_google בעתיד.')}
</body></html>`, 'utf8');

  console.log('\n=== TARGETED B SUMMARY (no DB writes) ===');
  console.log(`judged: ${results.length}/${targets.length}`);
  console.log(`✅ sure_right:        ${tally.sure_right}`);
  console.log(`❌ wrong_or_notfound: ${tally.wrong_or_notfound}`);
  console.log(`❓ still_maybe:       ${tally.still_maybe}`);
  console.log('--- cost accounting ---');
  console.log(`Text Search (IDs-only): ${gp.calls.textSearch} — $0`);
  console.log(`Details (minimal): ${gp.calls.details} calls | NEW ids: ${newIds} | cache hits: ${cacheHits}`);
  console.log(`Google est: ~$${costG} | Anthropic: $${llmUsd.toFixed(3)} (${llmCalls} calls)${llmDead ? ' [credit died mid-run]' : ''}`);
  console.log('CSV : audit-output/targeted-b.csv');
  console.log('HTML: audit-output/targeted-b.html');
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
