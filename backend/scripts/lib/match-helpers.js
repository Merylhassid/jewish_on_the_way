'use strict';

/**
 * Shared matching helpers for the Google Places verification pipeline.
 * Pure functions — no DB / no network — so they are unit-testable.
 */

// Remove Hebrew niqqud/cantillation, quotes/gershayim, punctuation; lowercase; collapse spaces.
function normalizeName(raw) {
  if (!raw) return '';
  return String(raw)
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '') // Hebrew points/accents
    .replace(/[̀-ͯ]/g, '') // Latin diacritics
    .replace(/["'`׳״“”‘’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // drop punctuation
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance (iterative, O(n*m)).
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      cur[j + 1] = Math.min(prev[j + 1] + 1, cur[j] + 1, prev[j] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

// Token Jaccard overlap on whitespace tokens.
function tokenJaccard(a, b) {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

// Generic words that carry no identifying signal (place category / filler).
// Removed before similarity so a coincidental shared "cafe"/"בריאות" can't
// create a false match (e.g. restaurant next to "מכבי שירותי בריאות").
const STOPWORDS = new Set([
  // Hebrew
  'מסעדת', 'מסעדה', 'בר', 'קפה', 'פיצה', 'פיצריה', 'בריאות', 'שירותי',
  'שירות', 'מרכז', 'בית', 'של', 'ה', 'את', 'אוכל', 'בייקרי', 'בייגל',
  'מאפים', 'מאפה', 'גריל', 'כשר', 'כשרה', 'סניף', 'שף', 'אותנטית',
  'אותנטי', 'מטבח', 'קניון', 'טבעוני', 'טבעונית',
  // English
  'restaurant', 'cafe', 'coffee', 'pizza', 'pizzeria', 'bar', 'grill',
  'kosher', 'the', 'of', 'and', 'center', 'centre', 'mall', 'deli',
  'bakery', 'shop', 'house', 'food', 'lab', 'kitchen', 'st', 'branch',
]);

function stripStopwords(normalized) {
  const kept = normalized.split(' ').filter((t) => t && !STOPWORDS.has(t));
  const joined = kept.join(' ');
  // If everything was a stopword, fall back to the original to avoid 0/0.
  return joined || normalized;
}

// Rough Hebrew -> Latin consonant transliteration (Hebrew is written without vowels,
// so we compare consonant skeletons). Multi-char values are fine.
const HEB_TO_LAT = {
  א: '', ב: 'b', ג: 'g', ד: 'd', ה: 'h', ו: 'v', ז: 'z', ח: 'h',
  ט: 't', י: 'y', כ: 'k', ך: 'k', ל: 'l', מ: 'm', ם: 'm', נ: 'n',
  ן: 'n', ס: 's', ע: '', פ: 'p', ף: 'p', צ: 'ts', ץ: 'ts', ק: 'k',
  ר: 'r', ש: 'sh', ת: 't',
};

// Consonant skeleton from an already-normalized string: transliterate Hebrew,
// drop Latin vowels/y/spaces/digits.
function skeletonOf(norm) {
  let out = '';
  for (const ch of norm) {
    out += HEB_TO_LAT[ch] !== undefined ? HEB_TO_LAT[ch] : ch;
  }
  return out.replace(/[aeiouwy\s0-9]/g, '');
}
function consonantSkeleton(raw) {
  return skeletonOf(normalizeName(raw));
}

function editRatio(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1 - levenshtein(a, b) / maxLen : 0;
}

// Containment: are all of the shorter name's meaningful tokens present in the
// longer name? Our stored names are often terse ("אצה") vs Google's fuller name
// ("אצה סושי בר נהריה"). Tokens < 2 chars are ignored (too generic).
function containmentScore(a, b) {
  const toks = (s) => s.split(' ').filter((t) => t.length >= 3);
  let sa = toks(a);
  let sb = toks(b);
  if (sa.length > sb.length) [sa, sb] = [sb, sa];
  if (!sa.length) return 0;
  const setB = new Set(sb);
  const matched = sa.filter((t) => setB.has(t)).length;
  return matched / sa.length;
}

// Name similarity 0..1 — best of: normalized edit ratio, token Jaccard,
// transliteration-tolerant consonant-skeleton edit ratio (Heb<->Latin), and
// token containment (short stored name ⊂ fuller Google name).
function nameSimilarity(nameA, nameB) {
  const a = stripStopwords(normalizeName(nameA));
  const b = stripStopwords(normalizeName(nameB));
  if (!a || !b) return 0;
  const skelA = skeletonOf(a);
  const skelB = skeletonOf(b);
  return Math.max(
    editRatio(a, b),
    tokenJaccard(a, b),
    editRatio(skelA, skelB),
    containmentScore(a, b),
  );
}

// Haversine distance in meters.
function distanceMeters(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null || Number.isNaN(v)))
    return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Tiered, distance-primary match classifier.
 *
 * Rationale (from dry-run data): our stored coordinates were geocoded from the
 * restaurant's own address, and Google Text Search already name-ranks results,
 * so a Google place a few dozen meters away IS our restaurant even when the
 * name string differs (Google often returns a Latin transliteration). Name is
 * a secondary confirmation, only trusted via the transliteration-tolerant
 * similarity. A strong name match can also rescue a moderate distance.
 *
 * Returns { confidence (0..1 heuristic), status, reason }.
 * status: 'verified' | 'flagged' | 'no_match'
 */
function scoreMatch({ nameSim, distM, businessStatus }, cfg) {
  const c = {
    VERIFY_DIST_M: 75, // very close => our place regardless of name
    NEAR_DIST_M: 250, // near + decent name => verified
    NEAR_NAME_MIN: 0.5,
    FLAG_DIST_M: 1200, // within town + good name => needs eyeball
    FLAG_NAME_MIN: 0.6,
    NAME_STRONG: 0.85, // strong name match rescues moderate distance
    ...cfg,
  };

  const parts = [];
  if (distM != null) parts.push(`dist=${Math.round(distM)}m`);
  parts.push(`name=${nameSim.toFixed(2)}`);

  // Non-operational places: never auto-update; send to review.
  if (businessStatus && businessStatus !== 'OPERATIONAL') {
    parts.push(`business=${businessStatus}`);
    return {
      confidence: 0.4,
      status: 'flagged',
      reason: parts.join(' ') + ' (non-operational)',
    };
  }

  const near = distM != null && distM <= c.NEAR_DIST_M;
  const within = distM != null && distM <= c.FLAG_DIST_M;

  let status;
  let confidence;
  if (distM != null && distM <= c.VERIFY_DIST_M) {
    if (nameSim < (c.PROX_NAME_FLOOR ?? 0.3)) {
      // Very close but name too weak — likely a co-located business (mall,
      // clinic, lab) rather than the restaurant. Review, don't auto-update.
      status = 'flagged';
      confidence = 0.6;
      parts.push('proximity-name-mismatch');
    } else {
      status = 'verified';
      confidence = 0.95;
      parts.push('close-proximity');
    }
  } else if (near && nameSim >= c.NEAR_NAME_MIN) {
    status = 'verified';
    confidence = 0.88;
    parts.push('near+name');
  } else if (near || (within && nameSim >= c.FLAG_NAME_MIN)) {
    status = 'flagged';
    confidence = 0.7;
    parts.push('needs-review');
  } else if (nameSim >= c.NAME_STRONG && within) {
    status = 'flagged';
    confidence = 0.68;
    parts.push('strong-name');
  } else {
    status = 'no_match';
    confidence = 0.2;
    parts.push('no-match');
  }
  return { confidence, status, reason: parts.join(' ') };
}

module.exports = {
  normalizeName,
  levenshtein,
  tokenJaccard,
  nameSimilarity,
  distanceMeters,
  scoreMatch,
  consonantSkeleton,
  skeletonOf,
  editRatio,
};
