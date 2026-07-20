'use strict';
/*
 * Address-first match classifier (pure, no API/DB). Decides whether a Google
 * candidate is the same place as our restaurant based on name + street + house
 * number + city, tolerant to Hebrew<->English transliteration. Used by the
 * offline analysis and the combined dry-run pipeline.
 */
const { nameSimilarity, normalizeName, consonantSkeleton } = require('./match-helpers');

const BRANDS = ['ארומה', 'aroma', 'קופיקס', 'cofix', 'קפה קפה', 'פיצה האט', 'pizza hut', 'בורגר קינג',
  'burger king', 'מקדונלד', 'mcdonald', 'בורגרים', 'burgerim', 'ברמן', 'roladin', 'רולדין', 'גרג',
  'greg', 'רבר', 'rebar', 'ארקפה', 'arcaffe', 'לנדוור', 'domino', 'דומינו', 'b-fresh', 'bfresh',
  'וופל בר', 'פיצה שמש', 'שיפודי', 'בורגראנץ', 'פיצה פרגו'];
const GENERIC = new Set(['פיצה', 'פלאפל', 'שווארמה', 'קפה', 'מסעדה', 'מסעדת', 'בר', 'מאפייה', 'סושי',
  'בורגר', 'שניצל', 'חומוס', 'גריל', 'נודלס', 'קייטרינג', 'pizza', 'falafel', 'cafe', 'bar', 'grill',
  'sushi', 'burger', 'restaurant', 'bakery']);

function nameType(name) {
  const norm = normalizeName(name);
  const meaningful = norm.split(' ').filter((t) => !GENERIC.has(t) && t.length >= 2);
  if (!meaningful.length) return 'generic';
  if (BRANDS.some((b) => norm.includes(b))) return 'chain';
  return 'unique';
}

// "Loose key": consonant skeleton with transliteration-ambiguous letters removed
// (vav/he dropped, p/f and k/q folded) so Hebrew<->English place names align.
const looseKey = (s) => consonantSkeleton(s).replace(/[vhw]/g, '').replace(/f/g, 'p').replace(/k/g, 'q');

function editRatio(a, b) {
  if (!a || !b) return 0;
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const max = Math.max(m, n); return max ? 1 - d[m][n] / max : 0;
}
function tokenInAddress(token, gNorm) {
  if (!token || token.length < 3) return false;
  if (gNorm.includes(token)) return true;
  const ts = looseKey(token); if (ts.length < 3) return false;
  if (looseKey(gNorm).includes(ts)) return true;
  return gNorm.split(' ').some((gt) => gt.length >= 3 && editRatio(ts, looseKey(gt)) >= 0.8);
}
function ourCity(addr) {
  if (!addr) return '';
  let parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  parts = parts.filter((x) => !/israel|ישראל|^\d/i.test(x));
  return normalizeName(parts[parts.length - 1] || '');
}
const houseNum = (a) => { const m = (a || '').match(/\b(\d{1,4})\b/); return m ? m[1] : ''; };
const streetTokens = (a) => normalizeName((a || '').split(',')[0] || '')
  .split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t));

/**
 * Classify a candidate. Row fields: old_name, old_address, google_name,
 * google_address, name_sim, business_status, google_rating, google_phone, has_photo.
 * Returns { promote, nt, reasons, suspicious, houseExact, streetMatch, cityMatch }.
 */
function classifyAddressFirst(r) {
  const sim = Number(r.name_sim);
  const nt = nameType(r.old_name);
  const active = r.business_status === 'OPERATIONAL';
  const gAddr = r.google_address || '';
  const gNorm = normalizeName(gAddr);
  const hasData = !!(r.google_rating || r.google_phone || r.has_photo === 'yes');
  const hn1 = Number(houseNum(r.old_address)), hn2 = Number(houseNum(gAddr));
  const houseExact = !!(hn1 && hn2 && hn1 === hn2);
  const streetMatch = streetTokens(r.old_address).some((t) => tokenInAddress(t, gNorm));
  const oc = ourCity(r.old_address);
  const cityMatch = !!oc && (gNorm.includes(oc) || tokenInAddress(oc, gNorm));
  const addressExact = streetMatch && houseExact && cityMatch;
  const dist = Number(r.distance_m);

  const reasons = [];
  let promote = false;
  if (!active) reasons.push('not-operational');
  else if (nt === 'generic') reasons.push('generic-name');
  else if (!hasData && !r.google_name) reasons.push('no-google-candidate');
  else if (!hasData) reasons.push('address-only-no-data');
  else if (nt === 'unique') {
    // address-first is a *structural* match — it must be backed by a real
    // street+house alignment, OR a near-identical name on the same street.
    // A high name score alone (city-only, no street) is NOT address-first; it
    // routes to the LLM/city-only rescue. A mall/clinic (sim ~0) never promotes.
    // (Codex hardening.)
    if (cityMatch && sim >= 0.5 && (addressExact || (sim >= 0.8 && streetMatch))) promote = true;
    else {
      if (!cityMatch) reasons.push('no-city-match');
      if (sim < 0.5) reasons.push('name<0.5-needs-llm');
      else if (!addressExact && !streetMatch) reasons.push('no-street-match-city-only-llm');
      else reasons.push('weak-address-needs-llm');
    }
  } else if (nt === 'chain') {
    // Chains have multiple branches on the same street — require an EXACT house
    // number match; any house difference goes to the LLM. (Codex hardening.)
    if (cityMatch && streetMatch && houseExact && sim >= 0.75) promote = true;
    else reasons.push('chain-needs-exact-street+house');
  }
  const shortName = normalizeName(r.old_name).replace(/[^\p{L}]/gu, '').length <= 3;
  const suspicious = promote && (nt === 'chain' || shortName || (sim < 0.5 && !addressExact));
  return { promote, nt, reasons, suspicious, houseExact, streetMatch, cityMatch, addressExact };
}

module.exports = { classifyAddressFirst, nameType, looseKey, ourCity, houseNum };
