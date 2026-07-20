/*
 * PILOT B — re-search 100 unmatched restaurants on Google WITHOUT our broken
 * coordinates. NO DB writes, NO photos, NO data changes. Measures real cost.
 *
 * Sample (100, mixed): red triage (wrong candidate) + Phase-A rejected +
 * Phase-A still-maybe + rows with no candidate at all.
 *
 * Search (per restaurant, NO locationBias):
 *   V1 name+city · V2 cleaned-name+city · V3 name+street  — IDs-only, up to 5 each.
 * Candidates: skip the previously-rejected place_id unless >=2 variants return it.
 * Details: cache from previous runs first; minimal field mask only for NEW ids.
 * Judgment: deterministic rules first; LLM (if credit) for borderline; else maybe.
 *
 * Output: pilot-b.{html,csv} with 3 groups + precise cost accounting.
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { GooglePlaces } = require('./lib/google-places');
const { nameSimilarity, normalizeName } = require('./lib/match-helpers');
const { classifyAddressFirst, nameType, ourCity } = require('./lib/address-match');

const SAMPLE_SIZE = 100;
const MAX_TS = 350, MAX_DETAILS = 400, MAX_LLM_USD = 1.0;
const MIN_MASK = 'id,displayName,formattedAddress,location,businessStatus,types,primaryType';
const DETAILS_MIN_USD = 0.017; // Pro-tier estimate — real number verified in console
const MODEL = process.env.SMART_SEARCH_LLM_MODEL || 'claude-haiku-4-5-20251001';
const LLM_IN = 1 / 1e6, LLM_OUT = 5 / 1e6;

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

let seed = 20260706; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

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
  // hard rejects
  if (cand.types && NONFOOD_RE.test(cand.types)) return { verdict: 'reject', score: -1, why: 'לא-מזון', sim, af };
  if (ADDRESS_AS_NAME_RE.test(cand.name) && sim < 0.4) return { verdict: 'reject', score: -1, why: 'כתובת-בתור-שם', sim, af };
  if (cand.status && cand.status !== 'OPERATIONAL' && sim < 0.7) return { verdict: 'reject', score: -1, why: 'סגור', sim, af };
  // decisions
  if (nt === 'unique' && (sim >= 0.75 || contains) && af.cityMatch)
    return { verdict: 'yes', score, why: `שם ייחודי תואם (sim ${sim.toFixed(2)}) + עיר`, sim, af };
  if ((sim >= 0.5 || contains) && af.cityMatch && af.streetMatch && nt !== 'chain')
    return { verdict: 'yes', score, why: `שם תואם + עיר + רחוב`, sim, af };
  if (nt === 'chain' && (sim >= 0.75 || contains) && af.streetMatch && af.cityMatch)
    return { verdict: 'yes', score, why: `רשת — רחוב תואם (אותו סניף)`, sim, af };
  if (nt === 'chain' && (sim >= 0.75 || contains))
    return { verdict: 'borderline', score, why: `רשת, רחוב לא אומת — אולי סניף אחר`, sim, af };
  if (nt === 'generic' && af.addressExact)
    return { verdict: 'yes', score, why: `שם גנרי אבל כתובת מדויקת`, sim, af };
  if (sim >= 0.4 || contains || addrScore >= 2)
    return { verdict: 'borderline', score, why: `סימנים חלקיים (sim ${sim.toFixed(2)}, addr ${addrScore})`, sim, af };
  return { verdict: 'reject', score, why: `אין התאמה (sim ${sim.toFixed(2)})`, sim, af };
}

(async () => {
  // ── build sample ──
  const triage = toObjs(parseCsv(path.join(__dirname, '..', 'audit-output', 'pending-triage.csv')));
  const rejudge = toObjs(parseCsv(path.join(__dirname, '..', 'audit-output', 'rejudge-maybe-corrected.csv')));
  const resolved = toObjs(parseCsv(path.join(__dirname, '..', 'audit-output', 'combined-dryrun-1783240537425-resolved.csv')));
  const rejById = new Map(rejudge.map((r) => [r.id, r]));

  const reds = shuffle(triage.filter((r) => r.triage === 'wrong')).slice(0, 40).map((r) => ({ ...r, pool: 'red' }));
  const aWrong = shuffle(rejudge.filter((r) => r.bucket === 'sure_wrong')).slice(0, 30).map((r) => ({ ...r, pool: 'a-wrong' }));
  const aMaybe = shuffle(rejudge.filter((r) => r.bucket === 'still_maybe')).slice(0, 20).map((r) => ({ ...r, pool: 'a-maybe' }));
  const noCand = shuffle(resolved.filter((r) => (r.resolved_final || r.final) !== 'verified' && (r.resolved_final || r.final) !== 'error' && !r.google_name)).slice(0, 10).map((r) => ({ ...r, pool: 'no-cand' }));
  const sample = [...reds, ...aWrong, ...aMaybe, ...noCand].slice(0, SAMPLE_SIZE);
  console.log(`\n=== PILOT B — ${sample.length} rows (red ${reds.length} / a-wrong ${aWrong.length} / a-maybe ${aMaybe.length} / no-cand ${noCand.length}) ===`);
  console.log('NO locationBias · NO DB writes · minimal Details for new ids only\n');

  // ── details cache from ALL previous paid runs ──
  const cache = new Map();
  for (const r of resolved) if (r.google_place_id) cache.set(r.google_place_id, {
    name: r.google_name, address: r.google_address, status: r.business_status,
    types: r.google_types || r.google_primary_type || '', uri: r.google_maps_uri,
  });
  console.log(`details cache loaded: ${cache.size} place_ids (already paid for)\n`);

  const gp = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 120 });
  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let llmDead = false, llmUsd = 0, llmCalls = 0;
  let cacheHits = 0, newIds = 0;
  const tally = { sure_right: 0, wrong_or_notfound: 0, still_maybe: 0 };
  const out = [];

  for (const row of sample) {
    if (gp.calls.textSearch >= MAX_TS || gp.calls.details >= MAX_DETAILS) { console.log('[budget] Google cap'); break; }
    const city = ourCity(row.old_address) || '';
    const cleaned = normalizeName(row.old_name).replace(GENERIC_WORDS, '').replace(/\s+/g, ' ').trim();
    const street = streetOf(row.old_address);
    const oldPid = row.google_place_id || '';

    const variants = [
      `${row.old_name} ${city}`.trim(),
      cleaned && cleaned !== normalizeName(row.old_name) ? `${cleaned} ${city}`.trim() : null,
      street ? `${row.old_name} ${street}` : null,
    ].filter(Boolean);

    // collect candidate ids with variant counts
    const found = new Map(); // pid -> nVariants
    for (const q of variants) {
      try { (await gp.searchIds(q, { max: 5 })).forEach((pid) => found.set(pid, (found.get(pid) || 0) + 1)); }
      catch (e) { /* count and continue */ }
    }

    // old rejected candidate: keep only with strong re-evidence (>=2 variants)
    if (oldPid && found.has(oldPid) && found.get(oldPid) < 2) found.delete(oldPid);

    // resolve details (cache first, minimal mask for new)
    const cands = [];
    for (const [pid, nVar] of [...found.entries()].slice(0, 8)) {
      let d = cache.get(pid);
      if (d) cacheHits++;
      else {
        if (gp.calls.details >= MAX_DETAILS) break;
        try {
          const raw = await gp.getDetails(pid, { mask: MIN_MASK });
          d = { name: raw.displayName?.text || '', address: raw.formattedAddress || '',
            status: raw.businessStatus || '', types: (raw.types || []).join(';'), uri: '' };
          cache.set(pid, d); newIds++;
        } catch (e) { continue; }
      }
      cands.push({ pid, variants: nVar, ...d });
    }

    // judge all candidates, pick best
    let best = null;
    for (const cand of cands) {
      const j = judgeCandidate(row, cand);
      if (!best || j.score > best.j.score) best = { cand, j };
    }

    let group, why, gName = '', gAddr = '', pid = '';
    if (!best || best.j.verdict === 'reject') {
      group = 'wrong_or_notfound';
      why = cands.length ? `נבדקו ${cands.length} מועמדים — אף אחד לא מתאים (${best ? best.j.why : ''})` : 'גוגל לא החזיר אף מועמד';
    } else {
      gName = best.cand.name; gAddr = best.cand.address; pid = best.cand.pid;
      if (best.j.verdict === 'yes') { group = 'sure_right'; why = best.j.why + (pid === oldPid ? ' · המועמד הישן חזר עם ראיה חזקה' : ''); }
      else {
        // borderline -> LLM if possible
        if (!llmDead && llmUsd < MAX_LLM_USD) {
          try {
            const resp = await llm.messages.create({
              model: MODEL, max_tokens: 180,
              system: 'Same physical restaurant? Hebrew<->English translation/transliteration = same name. Our address may be wrong; Google is right. Chains: different street = different branch = no. JSON only: {"same_place":"yes|no|uncertain","confidence":0-1,"reason":"short Hebrew"}',
              messages: [{ role: 'user', content: JSON.stringify({ A: { name: row.old_name, address: row.old_address }, B: { name: gName, address: gAddr }, name_type: nameType(row.old_name) }) }],
            });
            llmCalls++;
            llmUsd += (resp.usage?.input_tokens || 0) * LLM_IN + (resp.usage?.output_tokens || 0) * LLM_OUT;
            const m = resp.content.map((c) => c.text || '').join('').match(/\{[\s\S]*\}/);
            const v = m ? JSON.parse(m[0]) : { same_place: 'uncertain', confidence: 0 };
            const conf = Number(v.confidence) || 0;
            if (String(v.same_place).toLowerCase() === 'yes' && conf >= 0.85) { group = 'sure_right'; why = `LLM אישר (${conf}): ${v.reason || ''}`; }
            else if (String(v.same_place).toLowerCase() === 'no' && conf >= 0.85) { group = 'wrong_or_notfound'; why = `LLM דחה (${conf}): ${v.reason || ''}`; }
            else { group = 'still_maybe'; why = `LLM לא הכריע: ${v.reason || best.j.why}`; }
          } catch (e) { llmDead = true; group = 'still_maybe'; why = best.j.why + ' · [LLM לא זמין - אין קרדיט]'; }
        } else { group = 'still_maybe'; why = best.j.why + (llmDead ? ' · [LLM לא זמין - אין קרדיט]' : ''); }
      }
    }
    tally[group]++;
    out.push({ row, group, gName, gAddr, pid, why });
    if (out.length % 20 === 0) console.log(`  ...${out.length}/${sample.length}  right=${tally.sure_right} wrong/nf=${tally.wrong_or_notfound} maybe=${tally.still_maybe}  TS=${gp.calls.textSearch} D=${gp.calls.details} cacheHits=${cacheHits}`);
  }

  // ── outputs ──
  const outDir = path.join(__dirname, '..', 'audit-output');
  const csvF = path.join(outDir, 'pilot-b.csv');
  const COLS = ['group', 'pool', 'id', 'old_name', 'old_address', 'new_google_name', 'new_google_address', 'new_place_id', 'reason'];
  fs.writeFileSync(csvF, '﻿' + [COLS.join(','), ...out.map((x) => [x.group, x.row.pool, x.row.id, x.row.old_name, x.row.old_address, x.gName, x.gAddr, x.pid, x.why].map(csvEsc).join(','))].join('\n') + '\n', 'utf8');

  const mapsQ = (r) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${r.old_name} ${r.old_address || ''}`);
  const pinQ = (pid) => pid ? `https://www.google.com/maps/place/?q=place_id:${pid}` : '';
  const sec = (title, color, items, note) => `<h2 style="color:${color}">${title} — ${items.length}</h2><p class="note">${note}</p>
<table><thead><tr><th>id</th><th>pool</th><th>השם שלנו</th><th>כתובת שלנו</th><th>גוגל מצא (חדש)</th><th>כתובת גוגל</th><th>נימוק</th><th>קישורים</th></tr></thead><tbody>` +
    items.map((x) => `<tr><td>${esc(x.row.id)}</td><td>${esc(x.row.pool)}</td><td><b>${esc(x.row.old_name)}</b></td><td>${esc(x.row.old_address)}</td>
<td>${esc(x.gName || '—')}</td><td>${esc(x.gAddr || '')}</td><td class="why">${esc(x.why)}</td>
<td><a href="${esc(mapsQ(x.row))}" target="_blank">שלנו</a>${x.pid ? ` · <a href="${esc(pinQ(x.pid))}" target="_blank">פין גוגל</a>` : ''}</td></tr>`).join('') + '</tbody></table>';
  const g = (n) => out.filter((x) => x.group === n);
  const costG = (newIds * DETAILS_MIN_USD).toFixed(2);
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>פיילוט B — חיפוש מחדש</title>
<style>body{font-family:Arial;margin:16px;background:#fafafa}h1{font-size:18px}h2{font-size:15px;margin:22px 0 4px}
.note{font-size:12px;color:#666;margin:0 0 6px}.sum{font-size:13px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px 14px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:12px;background:#fff}th,td{border:1px solid #e0e0e0;padding:4px 7px;text-align:right;vertical-align:top}
th{background:#eceff1}tr:nth-child(even){background:#f7f9fa}td.why{max-width:280px;color:#455a64}a{color:#1565c0}</style></head><body>
<h1>פיילוט B — חיפוש מחדש בלי locationBias (${out.length} מסעדות)</h1>
<div class="sum">
✅ בטוח נכון: <b>${tally.sure_right}</b> · ❌ לא נכון/לא נמצא: <b>${tally.wrong_or_notfound}</b> · ❓ עדיין אולי: <b>${tally.still_maybe}</b><br>
Text Search: ${gp.calls.textSearch} (IDs-only) · Details חדשים: ${newIds} · cache hits: ${cacheHits}<br>
עלות Google משוערת: ~$${costG} (Details מינימלי) + $0 חיפושים · Anthropic: $${llmUsd.toFixed(3)} (${llmCalls})
</div>
${sec('✅ בטוח נכון', '#1b5e20', g('sure_right'), 'מועמד חדש שעומד בכללים (שם ייחודי+עיר / שם+רחוב / רשת+רחוב). מוכנים ל-apply אחרי אישורך.')}
${sec('❓ עדיין אולי', '#e65100', g('still_maybe'), 'גבוליים — חלקם ממתינים ל-LLM (אין קרדיט).')}
${sec('❌ לא נכון / לא נמצא', '#b71c1c', g('wrong_or_notfound'), 'גם חיפוש נקי לא מצא התאמה — כנראה סגורות או לא קיימות בגוגל.')}
</body></html>`;
  fs.writeFileSync(path.join(outDir, 'pilot-b.html'), html, 'utf8');

  console.log('\n=== PILOT B SUMMARY (no DB writes) ===');
  console.log(`judged: ${out.length}/${sample.length}`);
  console.log(`✅ sure_right:        ${tally.sure_right}`);
  console.log(`❌ wrong_or_notfound: ${tally.wrong_or_notfound}`);
  console.log(`❓ still_maybe:       ${tally.still_maybe}${llmDead ? ' (LLM unavailable for part)' : ''}`);
  console.log('--- cost accounting ---');
  console.log(`Text Search calls (IDs-only): ${gp.calls.textSearch}`);
  console.log(`Details calls (minimal mask): ${gp.calls.details} | NEW place_ids: ${newIds} | cache hits: ${cacheHits}`);
  console.log(`Google est: ~$${costG} (details) + $0.00 (searches, IDs-only SKU) — verify actuals in console!`);
  console.log(`Anthropic: $${llmUsd.toFixed(3)} (${llmCalls} calls)${llmDead ? ' — credit ran out mid-run' : ''}`);
  console.log('CSV : audit-output/pilot-b.csv');
  console.log('HTML: audit-output/pilot-b.html');
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
