/* Standalone sanity tests for match-helpers (run: node scripts/lib/match-helpers.test.js). */
'use strict';
const assert = require('assert');
const {
  normalizeName,
  nameSimilarity,
  distanceMeters,
  scoreMatch,
} = require('./match-helpers');

let passed = 0;
const t = (name, fn) => {
  fn();
  passed++;
  console.log('  ✓', name);
};

t('normalizeName strips niqqud, quotes, punctuation', () => {
  assert.strictEqual(normalizeName('פִּיצה  האט!'), 'פיצה האט');
  assert.strictEqual(normalizeName('Café  "Grég"'), 'cafe greg');
  assert.strictEqual(normalizeName('בֵּית קָפֶה'), 'בית קפה');
});

t('nameSimilarity: identical = 1, unrelated is low', () => {
  assert.strictEqual(nameSimilarity('פיצה האט', 'פיצה האט'), 1);
  assert.ok(nameSimilarity('פיצה האט', 'מספרת דוד') < 0.3);
});

t('nameSimilarity: token reorder / partial still high-ish', () => {
  assert.ok(nameSimilarity('קפה גרג', 'גרג קפה') >= 0.5);
});

t('nameSimilarity: Hebrew<->Latin transliteration via consonant skeleton', () => {
  assert.ok(nameSimilarity('חבש', 'Habash') >= 0.8, 'חבש~Habash');
  // Above the 0.3 proximity floor => still verified at close range.
  assert.ok(nameSimilarity('בטעם של קובי', 'Bataam Shel Kobi Catering') >= 0.3);
  assert.ok(nameSimilarity('אפטר פיצה בר', 'After Pizza Bar') >= 0.4);
});

t('nameSimilarity: short stored name contained in fuller Google name', () => {
  assert.strictEqual(nameSimilarity('אצה', 'אצה סושי בר נהריה'), 1);
  assert.strictEqual(nameSimilarity('שני', 'שני קרית אתא'), 1);
  // 1-char / generic tokens are ignored, so no false full-containment
  assert.ok(nameSimilarity('בר', 'פטריקס האגם בר מסעדה') < 1);
});

t('distanceMeters: ~0 for same point, sane for known gap', () => {
  assert.ok(distanceMeters(32.08, 34.78, 32.08, 34.78) < 1);
  const d = distanceMeters(32.0, 34.0, 32.0, 34.001); // ~94m east
  assert.ok(d > 80 && d < 110, `got ${d}`);
});

t('distanceMeters: null on missing coords', () => {
  assert.strictEqual(distanceMeters(1, 2, null, 4), null);
});

t('scoreMatch: very close + transliteration name match => verified', () => {
  // Real transliteration cases keep a positive skeleton similarity (חבש~Habash=1).
  const r = scoreMatch({ nameSim: 0.8, distM: 9, businessStatus: 'OPERATIONAL' });
  assert.strictEqual(r.status, 'verified');
});

t('scoreMatch: very close but name totally mismatched (mall) => flagged', () => {
  const r = scoreMatch({ nameSim: 0, distM: 49, businessStatus: 'OPERATIONAL' });
  assert.strictEqual(r.status, 'flagged');
  assert.ok(r.reason.includes('proximity-name-mismatch'));
});

t('nameSimilarity: co-located clinic does NOT falsely match via generic words', () => {
  // Real bug: "שומשום בר בריאות" (restaurant) vs "מכבי שירותי בריאות" (clinic).
  // Only the shared generic words overlapped -> must score low now.
  assert.ok(nameSimilarity('שומשום בר בריאות', 'מכבי שירותי בריאות') < 0.3);
  assert.ok(nameSimilarity('Resto', 'החשמונאים T Lab') < 0.3);
});

t('nameSimilarity: genuine transliteration survives stopword removal', () => {
  assert.ok(nameSimilarity('קנסאי יגאל אלון', 'Kansai') >= 0.3);
  assert.ok(nameSimilarity('חבש', 'Habash') >= 0.8);
});

t('scoreMatch: near + decent name => verified', () => {
  const r = scoreMatch({ nameSim: 0.7, distM: 200, businessStatus: 'OPERATIONAL' });
  assert.strictEqual(r.status, 'verified');
});

t('scoreMatch: exact name at 600m => flagged (not auto-verified)', () => {
  const r = scoreMatch({ nameSim: 1, distM: 600, businessStatus: 'OPERATIONAL' });
  assert.strictEqual(r.status, 'flagged');
});

t('scoreMatch: far + different name => no_match', () => {
  const r = scoreMatch({ nameSim: 0.1, distM: 900, businessStatus: 'OPERATIONAL' });
  assert.strictEqual(r.status, 'no_match');
});

t('scoreMatch: name match but 2.5km => no_match', () => {
  const r = scoreMatch({ nameSim: 0.5, distM: 2511, businessStatus: 'OPERATIONAL' });
  assert.strictEqual(r.status, 'no_match');
});

t('scoreMatch: closed permanently => flagged regardless', () => {
  const r = scoreMatch({ nameSim: 1, distM: 10, businessStatus: 'CLOSED_PERMANENTLY' });
  assert.strictEqual(r.status, 'flagged');
  assert.ok(r.reason.includes('CLOSED_PERMANENTLY'));
});

t('scoreMatch: missing distance => no_match (name alone cannot verify)', () => {
  const r = scoreMatch({ nameSim: 1, distM: null, businessStatus: 'OPERATIONAL' });
  assert.strictEqual(r.status, 'no_match');
});

console.log(`\n${passed} tests passed.`);
