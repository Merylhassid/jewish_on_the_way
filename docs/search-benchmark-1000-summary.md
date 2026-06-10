# Search Benchmark 1000 - Engineering Summary

Date: 2026-06-10  
Server: `http://49.12.189.108:3000`  
Scope: 1000 realistic user search queries against the production search flow.

## Files

- `docs/search-benchmark-1000.json` - fixed benchmark dataset.
- `docs/search-benchmark-1000.txt` - human-readable query list.
- `docs/search-benchmark-1000-results.json` - full raw results from the server.
- `docs/search-benchmark-1000-report.md` - generated detailed failure report.
- `docs/search-benchmark-1000-summary.md` - this engineering summary.

## Methodology

Each query was tested in two stages:

1. `POST /search` with the free-text query and Tel Aviv GPS coordinates.
   This checks intent classification and destination resolution.
2. If routing succeeded, the relevant result endpoint was queried:
   - restaurants: `GET /restaurants/search`
   - synagogues: `GET /synagogues`
   - minyans: `GET /minyans`
   - hosting: `GET /hosting/offers/search`

The benchmark is intentionally difficult: Hebrew, English, mixed language, destinations, no-destination GPS fallback, denomination phrases, Chabad variants, and conversational wording.

## Overall Results

| Area | Queries | Full Pass | Category Pass | Destination Pass | Result Pass |
|---|---:|---:|---:|---:|---:|
| Restaurants | 500 | 487 | 490 | 500 | 487 |
| Synagogues | 250 | 114 | 225 | 250 | 114 |
| Minyans | 150 | 150 | 150 | 150 | 150 |
| Hosting | 100 | 86 | 86 | 100 | 86 |
| Total | 1000 | 837 | 951 | 1000 | 837 |

## Main Findings

Destination resolution is strong in this benchmark: all 1000 queries resolved a destination or valid GPS fallback.

Restaurant search is strong: 487/500 full pass. The remaining failures mostly involve `מאפייה` and strict combinations like `מאפייה מהדרין`, where the intent is sometimes misclassified or the final restaurant search returns no exact/tag result.

Minyan search is very strong in this benchmark: 150/150 full pass. Important caveat: production data currently had upcoming minyan results only for Afula, so all minyan queries were intentionally aimed at Afula.

Hosting is good but not perfect: 86/100 full pass. Failures mostly involve conversational Hebrew such as `מחפש איפה להתארח לשבת`, which sometimes routes to `minyan` instead of `hosting`.

Synagogue search is the weakest result-retrieval area: 225/250 queries classified correctly as synagogue, but only 114/250 returned results. This usually means the model understood the intent and destination, but the final filtered query returned zero results.

## Top Failure Patterns

Most common failing focus terms:

- `נוסח ספרד`
- `בית כנסת ספרדי`
- `chabad house`
- `בית כנסת חב"ד`
- `בית כנסת חב״ד`
- `בית כנסת חבד`
- `בית כנסת אשכנזי`
- `מאפייה`
- `מחפש איפה להתארח לשבת`

## Technical Interpretation

The classifier is usually doing the right first step: it identifies the user intent and destination. The largest gap is not raw intent classification; it is strict downstream filtering.

For synagogues, denomination filtering can be too strict. If the system detects `chabad`, `sfarad`, or `ashkenaz`, it queries only matching denomination records. Many destinations have synagogues, but not necessarily with that exact denomination value in the DB. The user then gets no results even though a broader synagogue result would be useful.

For restaurants, food search is generally good, but terms that are broad or underspecified, such as `מאפייה`, can still be routed inconsistently. Multi-word food phrases such as `בורקס גבינה` should preserve the strong base food term and not collapse too quickly into a broad dairy/bakery fallback.

For hosting, the training/routing should get more Hebrew variants around `להתארח`, `ארוחת שבת`, and `משפחה מארחת`, because these are core real-world phrases.

## Recommended Fix Priority

1. Add synagogue fallback when denomination-filtered results are empty.
   If `בית כנסת חב"ד בפריז` has no Chabad-tagged result but Paris has synagogues, show all Paris synagogues with a message such as: `לא נמצאו בתי כנסת לפי הנוסח שביקשת - מציג בתי כנסת זמינים ביעד`.

2. Strengthen hosting classification for conversational Hebrew.
   Add examples and/or deterministic override for `להתארח לשבת`, `איפה להתארח`, `משפחה מארחת`, `ארוחת שבת אצל משפחה`.

3. Improve bakery/food handling.
   Add stronger restaurant signals for `מאפייה`, and treat food base terms separately from modifiers.

4. Keep destination resolver as-is for now.
   In this benchmark it performed very well.

5. Do not change the model architecture before submission.
   The failures are mostly routing/data/filtering problems, not a reason to replace TF-IDF + custom classifier.

## Academic Note

This benchmark is useful for the final report because it separates:

- intent classification quality,
- destination resolution quality,
- actual result retrieval quality.

That distinction is important. The AI classifier is stronger than the final user-facing success rate suggests; most serious failures happen after classification, in rule-based routing and database filtering.
