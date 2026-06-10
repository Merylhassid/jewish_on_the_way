# Search Benchmark 500 Report

Ran at: 2026-06-10T09:52:27.893Z
Server: http://49.12.189.108:3000

## Summary

- Completed queries: 1000/1000
- Evaluated queries in this report: 1000
- Overall pass: 965/1000 (96.5%)
- Category pass: 969/1000 (96.9%)
- Destination pass: 1000/1000 (100.0%)
- Result pass: 965/1000 (96.5%)

## By Category

| Category | Total | Overall | Category | Destination | Results |
|---|---:|---:|---:|---:|---:|
| restaurant | 500 | 500 (100.0%) | 500 | 500 | 500 |
| synagogue | 250 | 246 (98.4%) | 250 | 250 | 246 |
| minyan | 150 | 120 (80.0%) | 120 | 150 | 120 |
| hosting | 100 | 99 (99.0%) | 99 | 100 | 99 |

## Category Failures

| ID | Expected | Query | Got category | Expected dest | Got dest/city | Result count | Note |
|---|---|---|---|---|---|---:|---|
| q811 | minyan | מניין שחרית ספרדי בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q812 | minyan | מניין מנחה ספרדי בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q813 | minyan | מניין ערבית ספרדי בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q814 | minyan | צריך מניין לשחרית מחר ספרדי בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q815 | minyan | איפה מתפללים שחרית ספרדי בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q816 | minyan | יש מניין קרוב ספרדי בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q817 | minyan | minyan shacharit ספרדי in Afula | synagogue | Afula | Afula | 0 | search routing failed |
| q818 | minyan | mincha minyan ספרדי in Afula | synagogue | Afula | Afula | 0 | search routing failed |
| q819 | minyan | maariv minyan ספרדי in Afula | synagogue | Afula | Afula | 0 | search routing failed |
| q820 | minyan | prayer quorum ספרדי in Afula | synagogue | Afula | Afula | 0 | search routing failed |
| q821 | minyan | מניין שחרית חב"ד בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q822 | minyan | מניין מנחה חב"ד בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q823 | minyan | מניין ערבית חב"ד בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q824 | minyan | צריך מניין לשחרית מחר חב"ד בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q825 | minyan | איפה מתפללים שחרית חב"ד בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q826 | minyan | יש מניין קרוב חב"ד בעפולה | synagogue | Afula | Afula | 0 | search routing failed |
| q827 | minyan | minyan shacharit חב"ד in Afula | synagogue | Afula | Afula | 0 | search routing failed |
| q828 | minyan | mincha minyan חב"ד in Afula | synagogue | Afula | Afula | 0 | search routing failed |
| q829 | minyan | maariv minyan חב"ד in Afula | synagogue | Afula | Afula | 0 | search routing failed |
| q830 | minyan | prayer quorum חב"ד in Afula | synagogue | Afula | Afula | 0 | search routing failed |

## Destination Failures

| ID | Expected | Query | Got category | Expected dest | Got dest/city | Result count | Note |
|---|---|---|---|---|---|---:|---|
| - | - | none | - | - | - | - | - |

## Result Failures

| ID | Expected | Query | Got category | Expected dest | Got dest/city | Result count | Note |
|---|---|---|---|---|---|---:|---|
| q509 | synagogue | קהילה יהודית בדובאי | synagogue | Dubai | Dubai | 0 |  |
| q589 | synagogue | synagogue in Dubai | synagogue | Dubai | Dubai | 0 |  |
| q669 | synagogue | jewish community in Dubai | synagogue | Dubai | Dubai | 0 |  |
| q749 | synagogue | בית כנסת ספרדי בדובאי | synagogue | Dubai | Dubai | 0 |  |

## Recommendations

- Separate intent classification success from result retrieval success in the final report.
- For restaurant search, improve multi-word food handling so strong base terms like "בורקס" are not lost inside longer phrases such as "בורקס גבינה".
- For synagogue searches, review denomination filtering: if a denomination is detected but no matching records exist, fallback to all synagogues in that destination with a clear message.
- For minyan and hosting, the production DB currently has very sparse data; do not evaluate those features using many different cities unless more data is seeded.
- Keep this benchmark fixed and re-run it after every search change before submission.
