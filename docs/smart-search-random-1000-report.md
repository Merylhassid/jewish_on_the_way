# Smart Search Random 1000 Report

Ran at: 2026-07-02T05:34:42.474Z
Server: http://49.12.189.108:3000
GPS used: 32.0853, 34.7818

## Summary

- Completed queries: 1000/1000
- Overall pass: 543/1000 (54.3%)
- Category pass: 968/1000 (96.8%)
- Destination pass: 960/1000 (96.0%)
- Result pass: 586/1000 (58.6%)
- Search HTTP errors: 0

## By Category

| Category | Total | Overall | Category | Destination | Results |
|---|---:|---:|---:|---:|---:|
| restaurant | 400 | 290 (72.5%) | 400 | 372 | 306 |
| synagogue | 220 | 178 (80.9%) | 220 | 220 | 178 |
| minyan | 160 | 0 (0.0%) | 160 | 160 | 0 |
| hosting | 120 | 2 (1.7%) | 115 | 117 | 2 |
| destination | 50 | 35 (70.0%) | 35 | 45 | 50 |
| unknown | 50 | 38 (76.0%) | 38 | 46 | 50 |

## By Expected Behavior

| Behavior | Total | Overall | Category | Destination | Results |
|---|---:|---:|---:|---:|---:|
| should_route_and_try_results | 900 | 470 (52.2%) | 895 | 869 | 486 |
| destination_or_overview_ok | 50 | 35 (70.0%) | 35 | 45 | 50 |
| clarification_or_safe_no_results_ok | 30 | 22 (73.3%) | 22 | 30 | 30 |
| safe_no_results_ok | 20 | 16 (80.0%) | 16 | 16 | 20 |

## Category Failures

| ID | Expected | Query | Got category | Expected dest | Got dest/city | Route | Status | Result count | Reason |
|---|---|---|---|---|---|---|---:|---:|---|
| sq0785 | hosting | looking for meal near me | minyan | GPS fallback | Tel Aviv | /minyans/348 | 200 | 0 | wrong category/unsafe route |
| sq0787 | hosting | מחפש סעודה לידי | - | GPS fallback | - | - | 201 | 0 | wrong category/unsafe route |
| sq0788 | hosting | shabbat stay near me | minyan | GPS fallback | Tel Aviv | /minyans/348 | 200 | 0 | wrong category/unsafe route |
| sq0807 | hosting | איפה אפשר מחפש סעודה באזור שלי | - | GPS fallback | - | - | 201 | 0 | wrong category/unsafe route |
| sq0883 | hosting | מחפש סעודה בלונדון | - | London | - | - | 201 | 0 | wrong category/unsafe route |
| sq0903 | destination | kosher options around Athens | restaurant | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0905 | destination | מידע על טורונטו | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0906 | destination | מידע על מדריד | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0910 | destination | יעד מילאנו | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0916 | destination | יעד ציריך | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0919 | destination | מה יש לעשות בניו יורק | - | New York | - | - | 201 | 0 | wrong category/unsafe route |
| sq0920 | destination | מה יש לעשות באמסטרדם | - | Amsterdam | - | - | 201 | 0 | wrong category/unsafe route |
| sq0921 | destination | מה יש לעשות בלוס אנג׳לס | - | Los Angeles | - | - | 201 | 0 | wrong category/unsafe route |
| sq0925 | destination | יעד אנטוורפן | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0929 | destination | מה יש לעשות בז׳נבה | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0930 | destination | מה יש לעשות בבואנוס איירס | - | Buenos Aires | - | - | 201 | 0 | wrong category/unsafe route |
| sq0936 | destination | מידע על ז׳נבה | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0943 | destination | מה יש לעשות בקוסמוי | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0949 | destination | מה יש לעשות בפוקט | - | - | - | - | 201 | 0 | wrong category/unsafe route |
| sq0950 | destination | מה יש לעשות בפאפוס | - | Paphos | - | - | 201 | 0 | wrong category/unsafe route |
| sq0953 | unknown | אני רוצה משהו יהודי | synagogue | - | Bnei Brak | /synagogues/334?expandNearby=true&useUserGps=true | 201 | 0 | wrong category/unsafe route |
| sq0956 | unknown | איפה הכי יפה בעולם | synagogue | - | Haifa | /synagogues/395?expandNearby=true&useUserGps=true | 201 | 0 | wrong category/unsafe route |
| sq0957 | unknown | מסעדה בית כנסת מניין בתל אביב | restaurant | Tel Aviv | Tel Aviv | /restaurants/348?type=dairy&useUserGps=true&q=%D7%9E%D7%A1%D7%A2%D7%93%D7%94+%D7%91%D7%99%D7%AA+%D7%9B%D7%A0%D7%A1%D7%AA+%D7%9E%D7%A0%D7%99%D7%99%D7%9F+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91 | 201 | 0 | wrong category/unsafe route |
| sq0962 | unknown | מסעדה בית כנסת מניין בניו יורק | restaurant | New York | New York | /restaurants/463?type=dairy&useUserGps=true&q=%D7%9E%D7%A1%D7%A2%D7%93%D7%94+%D7%91%D7%99%D7%AA+%D7%9B%D7%A0%D7%A1%D7%AA+%D7%9E%D7%A0%D7%99%D7%99%D7%9F+%D7%91%D7%A0%D7%99%D7%95+%D7%99%D7%95%D7%A8%D7%A7 | 201 | 0 | wrong category/unsafe route |
| sq0966 | unknown | מסעדה בית כנסת מניין באילת | restaurant | Eilat | Eilat | /restaurants/399?type=dairy&useUserGps=true&q=%D7%9E%D7%A1%D7%A2%D7%93%D7%94+%D7%91%D7%99%D7%AA+%D7%9B%D7%A0%D7%A1%D7%AA+%D7%9E%D7%A0%D7%99%D7%99%D7%9F+%D7%91%D7%90%D7%99%D7%9C%D7%AA | 201 | 0 | wrong category/unsafe route |
| sq0968 | unknown | מסעדה בית כנסת מניין בפורטו | restaurant | - | Porto | /restaurants/297?type=dairy&useUserGps=true&q=%D7%9E%D7%A1%D7%A2%D7%93%D7%94+%D7%91%D7%99%D7%AA+%D7%9B%D7%A0%D7%A1%D7%AA+%D7%9E%D7%A0%D7%99%D7%99%D7%9F+%D7%91%D7%A4%D7%95%D7%A8%D7%98%D7%95 | 201 | 0 | wrong category/unsafe route |
| sq0976 | unknown | מסעדה בית כנסת מניין במיאמי | restaurant | Miami | Miami | /restaurants/464?type=dairy&useUserGps=true&q=%D7%9E%D7%A1%D7%A2%D7%93%D7%94+%D7%91%D7%99%D7%AA+%D7%9B%D7%A0%D7%A1%D7%AA+%D7%9E%D7%A0%D7%99%D7%99%D7%9F+%D7%91%D7%9E%D7%99%D7%90%D7%9E%D7%99 | 201 | 0 | wrong category/unsafe route |
| sq0980 | unknown | מסעדה בית כנסת מניין בברצלונה | restaurant | Barcelona | Barcelona | /restaurants/356?type=dairy&useUserGps=true&q=%D7%9E%D7%A1%D7%A2%D7%93%D7%94+%D7%91%D7%99%D7%AA+%D7%9B%D7%A0%D7%A1%D7%AA+%D7%9E%D7%A0%D7%99%D7%99%D7%9F+%D7%91%D7%91%D7%A8%D7%A6%D7%9C%D7%95%D7%A0%D7%94 | 201 | 0 | wrong category/unsafe route |
| sq0981 | unknown | פיצה באי ירח | restaurant | - | Pai | /restaurants/477?type=dairy&useUserGps=true&q=%D7%A4%D7%99%D7%A6%D7%94+%D7%91%D7%90%D7%99+%D7%99%D7%A8%D7%97 | 201 | 0 | wrong category/unsafe route |
| sq0990 | unknown | להתארח באי ירח | hosting | - | Pai | /hosting/477 | 201 | 0 | wrong category/unsafe route |
| sq0991 | unknown | מניין באי ירח | minyan | - | Pai | /minyans/477 | 201 | 0 | wrong category/unsafe route |
| sq0994 | unknown | בית כנסת באי ירח | synagogue | - | Pai | /synagogues/477?expandNearby=true&useUserGps=true | 201 | 0 | wrong category/unsafe route |

## Destination Failures

| ID | Expected | Query | Got category | Expected dest | Got dest/city | Route | Status | Result count | Reason |
|---|---|---|---|---|---|---|---:|---:|---|
| sq0025 | restaurant | אני בתל אביב אבל רוצה פיצנ באתונה | restaurant | Tel Aviv | - | - | 201 | 0 | wrong destination |
| sq0032 | restaurant | אני בתל אביב אבל רוצה חומוס באילת | restaurant | Tel Aviv | Eilat | /restaurants/399?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%97%D7%95%D7%9E%D7%95%D7%A1+%D7%91%D7%90%D7%99%D7%9C%D7%AA | 200 | 6 | wrong destination |
| sq0035 | restaurant | אני בתל אביב אבל רוצה bakery בציריך | restaurant | Tel Aviv | - | - | 201 | 0 | wrong destination |
| sq0046 | restaurant | אני בתל אביב אבל רוצה פלאפל בחיפה | restaurant | Tel Aviv | Haifa | /restaurants/395?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%A4%D7%9C%D7%90%D7%A4%D7%9C+%D7%91%D7%97%D7%99%D7%A4%D7%94 | 200 | 31 | wrong destination |
| sq0053 | restaurant | אני בתל אביב אבל רוצה מאפייה בקאן | restaurant | Tel Aviv | Cannes | /restaurants/325?type=dairy&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%9E%D7%90%D7%A4%D7%99%D7%99%D7%94+%D7%91%D7%A7%D7%90%D7%9F | 200 | 13 | wrong destination |
| sq0100 | restaurant | אני בתל אביב אבל רוצה sushii בבנגקוק | restaurant | Tel Aviv | Bangkok | /restaurants/470?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+sushi+%D7%91%D7%91%D7%A0%D7%92%D7%A7%D7%95%D7%A7 | 200 | 0 | wrong destination |
| sq0128 | restaurant | אני בתל אביב אבל רוצה humus בליסבון | restaurant | Tel Aviv | - | - | 201 | 0 | wrong destination |
| sq0130 | restaurant | אני בתל אביב אבל רוצה humus במרקש | restaurant | Tel Aviv | Marrakech | /restaurants/375?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+hummus+%D7%91%D7%9E%D7%A8%D7%A7%D7%A9 | 200 | 0 | wrong destination |
| sq0134 | restaurant | אני בתל אביב אבל רוצה פיצריה במיאמי | restaurant | Tel Aviv | Miami | /restaurants/464?type=dairy&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%A4%D7%99%D7%A6%D7%A8%D7%99%D7%94+%D7%91%D7%9E%D7%99%D7%90%D7%9E%D7%99 | 200 | 34 | wrong destination |
| sq0136 | restaurant | אני בתל אביב אבל רוצה פיצ בקוסמוי | restaurant | Tel Aviv | Ko Samui | /restaurants/472?type=dairy&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%A4%D7%99%D7%A6%D7%94+%D7%91%D7%A7%D7%95%D7%A1%D7%9E%D7%95%D7%99 | 200 | 7 | wrong destination |
| sq0137 | restaurant | אני בתל אביב אבל רוצה gelato בפאפוס | restaurant | Tel Aviv | Paphos | /restaurants/316?useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+gelato+%D7%91%D7%A4%D7%90%D7%A4%D7%95%D7%A1 | 200 | 11 | wrong destination |
| sq0147 | restaurant | אני בתל אביב אבל רוצה גלידה בעפולה | restaurant | Tel Aviv | Afula | /restaurants/430?type=dairy&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%92%D7%9C%D7%99%D7%93%D7%94+%D7%91%D7%A2%D7%A4%D7%95%D7%9C%D7%94 | 200 | 50 | wrong destination |
| sq0174 | restaurant | אני בתל אביב אבל רוצה פיצה בפראג | restaurant | Tel Aviv | Prague | /restaurants/323?type=dairy&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%A4%D7%99%D7%A6%D7%94+%D7%91%D7%A4%D7%A8%D7%90%D7%92 | 200 | 3 | wrong destination |
| sq0194 | restaurant | אני בתל אביב אבל רוצה bakery בפוקט | restaurant | Tel Aviv | Phuket | /restaurants/471?type=dairy&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+bakery+%D7%91%D7%A4%D7%95%D7%A7%D7%98 | 200 | 2 | wrong destination |
| sq0200 | restaurant | אני בתל אביב אבל רוצה בשרי בלרנקה | restaurant | Tel Aviv | Larnaca | /restaurants/363?type=meat&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%91%D7%A9%D7%A8%D7%99+%D7%91%D7%9C%D7%A8%D7%A0%D7%A7%D7%94 | 200 | 3 | wrong destination |
| sq0219 | restaurant | אני בתל אביב אבל רוצה פסטה במילאנו | restaurant | Tel Aviv | - | - | 201 | 0 | wrong destination |
| sq0245 | restaurant | אני בתל אביב אבל רוצה בשר בדובאי | restaurant | Tel Aviv | Dubai | /restaurants/340?type=meat&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%91%D7%A9%D7%A8+%D7%91%D7%93%D7%95%D7%91%D7%90%D7%99 | 200 | 13 | wrong destination |
| sq0286 | restaurant | אני בתל אביב אבל רוצה פיצנ בטורונטו | restaurant | Tel Aviv | - | - | 201 | 0 | wrong destination |
| sq0290 | restaurant | אני בתל אביב אבל רוצה fish בפראג | restaurant | Tel Aviv | Prague | /restaurants/323?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+fish+%D7%91%D7%A4%D7%A8%D7%90%D7%92 | 200 | 0 | wrong destination |
| sq0307 | restaurant | אני בתל אביב אבל רוצה pasta בנתניה | restaurant | Tel Aviv | Netanya | /restaurants/358?type=dairy&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+pasta+%D7%91%D7%A0%D7%AA%D7%A0%D7%99%D7%94 | 200 | 50 | wrong destination |
| sq0313 | restaurant | אני בתל אביב אבל רוצה בשרי בחיפה | restaurant | Tel Aviv | Haifa | /restaurants/395?type=meat&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%91%D7%A9%D7%A8%D7%99+%D7%91%D7%97%D7%99%D7%A4%D7%94 | 200 | 45 | wrong destination |
| sq0325 | restaurant | אני בתל אביב אבל רוצה דגים בקאן | restaurant | Tel Aviv | Cannes | /restaurants/325?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%93%D7%92%D7%99%D7%9D+%D7%91%D7%A7%D7%90%D7%9F | 200 | 0 | wrong destination |
| sq0328 | restaurant | אני בתל אביב אבל רוצה pizza בפוקט | restaurant | Tel Aviv | Phuket | /restaurants/471?type=dairy&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+pizza+%D7%91%D7%A4%D7%95%D7%A7%D7%98 | 200 | 2 | wrong destination |
| sq0330 | restaurant | אני בתל אביב אבל רוצה גליד באנטוורפן | restaurant | Tel Aviv | - | - | 201 | 0 | wrong destination |
| sq0354 | restaurant | אני בתל אביב אבל רוצה fish בחיפה | restaurant | Tel Aviv | Haifa | /restaurants/395?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+fish+%D7%91%D7%97%D7%99%D7%A4%D7%94 | 200 | 30 | wrong destination |
| sq0359 | restaurant | אני בתל אביב אבל רוצה hambuger בז׳נבה | restaurant | Tel Aviv | - | - | 201 | 0 | wrong destination |
| sq0363 | restaurant | אני בתל אביב אבל רוצה פיצ במדריד | restaurant | Tel Aviv | - | - | 201 | 0 | wrong destination |
| sq0370 | restaurant | אני בתל אביב אבל רוצה בשר בפראג | restaurant | Tel Aviv | Prague | /restaurants/323?type=meat&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%91%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91+%D7%90%D7%91%D7%9C+%D7%A8%D7%95%D7%A6%D7%94+%D7%91%D7%A9%D7%A8+%D7%91%D7%A4%D7%A8%D7%90%D7%92 | 200 | 10 | wrong destination |

## Result Failures

| ID | Expected | Query | Got category | Expected dest | Got dest/city | Route | Status | Result count | Reason |
|---|---|---|---|---|---|---|---:|---:|---|
| sq0002 | restaurant | looking for סושיי near me in Buenos Aires | restaurant | Buenos Aires | Buenos Aires | /restaurants/478?type=parve&useUserGps=true&q=looking+for+%D7%A1%D7%95%D7%A9%D7%99+near+me+in+Buenos+Aires | 200 | 0 | zero results |
| sq0027 | restaurant | אני נמצא בישראל ורוצה hummus באתונה | restaurant | - | - | - | 201 | 0 | zero results |
| sq0034 | restaurant | סוש מהדרין בטורונטו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0038 | restaurant | מחפש חמס כשר בטורונטו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0047 | restaurant | פלפל מהדרין במרקש | restaurant | - | Marrakech | /restaurants/375?type=parve&useUserGps=true&q=%D7%A4%D7%9C%D7%90%D7%A4%D7%9C+%D7%9E%D7%94%D7%93%D7%A8%D7%99%D7%9F+%D7%91%D7%9E%D7%A8%D7%A7%D7%A9 | 200 | 0 | zero results |
| sq0048 | restaurant | אני נמצא בישראל ורוצה פלפל בלוס אנג׳לס | restaurant | Los Angeles | Los Angeles | /restaurants/465?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%A0%D7%9E%D7%A6%D7%90+%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%95%D7%A8%D7%95%D7%A6%D7%94+%D7%A4%D7%9C%D7%90%D7%A4%D7%9C+%D7%91%D7%9C%D7%95%D7%A1+%D7%90%D7%A0%D7%92%D7%9C%D7%A1 | 200 | 0 | zero results |
| sq0058 | restaurant | humus מהדרין בקוסמוי | restaurant | - | Ko Samui | /restaurants/472?type=parve&useUserGps=true&q=hummus+%D7%9E%D7%94%D7%93%D7%A8%D7%99%D7%9F+%D7%91%D7%A7%D7%95%D7%A1%D7%9E%D7%95%D7%99 | 200 | 0 | zero results |
| sq0059 | restaurant | בשרי מהדרין בטוקיו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0060 | restaurant | אני נמצא בישראל ורוצה shwarma במילאנו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0061 | restaurant | looking for סוש near me in Paphos | restaurant | Paphos | Paphos | /restaurants/316?type=parve&useUserGps=true&q=looking+for+%D7%A1%D7%95%D7%A9%D7%99+near+me+in+Paphos | 200 | 0 | zero results |
| sq0063 | restaurant | שווארמה בקזבלנקה | restaurant | - | - | - | 201 | 0 | zero results |
| sq0064 | restaurant | looking for sushi near me in Paphos | restaurant | Paphos | Paphos | /restaurants/316?type=parve&useUserGps=true&q=looking+for+sushi+near+me+in+Paphos | 200 | 0 | zero results |
| sq0065 | restaurant | fish מהדרין בפראג | restaurant | Prague | Prague | /restaurants/323?type=parve&useUserGps=true&q=fish+%D7%9E%D7%94%D7%93%D7%A8%D7%99%D7%9F+%D7%91%D7%A4%D7%A8%D7%90%D7%92 | 200 | 0 | zero results |
| sq0067 | restaurant | hummus בניס | restaurant | - | Nice | /restaurants/353?type=parve&useUserGps=true&q=hummus+%D7%91%D7%A0%D7%99%D7%A1 | 200 | 0 | zero results |
| sq0073 | restaurant | פיצה בז׳נבה | restaurant | - | - | - | 201 | 0 | zero results |
| sq0079 | restaurant | kosher המבןרגר in Toronto | restaurant | - | - | - | 201 | 0 | zero results |
| sq0082 | restaurant | אני נמצא בישראל ורוצה falafel place במיאמי | restaurant | Miami | Miami | /restaurants/464?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%A0%D7%9E%D7%A6%D7%90+%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%95%D7%A8%D7%95%D7%A6%D7%94+falafel+place+%D7%91%D7%9E%D7%99%D7%90%D7%9E%D7%99 | 200 | 0 | zero results |
| sq0090 | restaurant | איפה אפשר לאכול humus בניו יורק? | restaurant | - | New York | /restaurants/463?type=parve&useUserGps=true&q=%D7%90%D7%99%D7%A4%D7%94+%D7%90%D7%A4%D7%A9%D7%A8+%D7%9C%D7%90%D7%9B%D7%95%D7%9C+hummus+%D7%91%D7%A0%D7%99%D7%95+%D7%99%D7%95%D7%A8%D7%A7%3F | 200 | 0 | zero results |
| sq0103 | restaurant | פלפל בטוקיו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0104 | restaurant | חומוס מהדרין בפריז | restaurant | Paris | Paris | /restaurants/294?type=parve&useUserGps=true&q=%D7%97%D7%95%D7%9E%D7%95%D7%A1+%D7%9E%D7%94%D7%93%D7%A8%D7%99%D7%9F+%D7%91%D7%A4%D7%A8%D7%99%D7%96 | 200 | 0 | zero results |
| sq0106 | restaurant | איפה אפשר לאכול דגים בפראג? | restaurant | - | Prague | /restaurants/323?type=parve&useUserGps=true&q=%D7%90%D7%99%D7%A4%D7%94+%D7%90%D7%A4%D7%A9%D7%A8+%D7%9C%D7%90%D7%9B%D7%95%D7%9C+%D7%93%D7%92%D7%99%D7%9D+%D7%91%D7%A4%D7%A8%D7%90%D7%92%3F | 200 | 0 | zero results |
| sq0109 | restaurant | kosher hummus in Miami | restaurant | Miami | Miami | /restaurants/464?type=parve&useUserGps=true&q=kosher+hummus+in+Miami | 200 | 0 | zero results |
| sq0115 | restaurant | איפה אפשר לאכול גליד בטורונטו? | restaurant | - | - | - | 201 | 0 | zero results |
| sq0116 | restaurant | אני נמצא בישראל ורוצה סוש בקזבלנקה | restaurant | - | - | - | 201 | 0 | zero results |
| sq0117 | restaurant | איפה אפשר לאכול fish בציריך? | restaurant | - | - | - | 201 | 0 | zero results |
| sq0119 | restaurant | אני נמצא בישראל ורוצה gelato במילאנו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0129 | restaurant | המבןרגר מהדרין בציריך | restaurant | - | - | - | 201 | 0 | zero results |
| sq0139 | restaurant | המבןרגר מהדרין בליסבון | restaurant | - | - | - | 201 | 0 | zero results |
| sq0146 | restaurant | איפה אפשר לאכול sushii בלוס אנג׳לס? | restaurant | - | Los Angeles | /restaurants/465?type=parve&useUserGps=true&q=%D7%90%D7%99%D7%A4%D7%94+%D7%90%D7%A4%D7%A9%D7%A8+%D7%9C%D7%90%D7%9B%D7%95%D7%9C+sushi+%D7%91%D7%9C%D7%95%D7%A1+%D7%90%D7%A0%D7%92%D7%9C%D7%A1%3F | 200 | 0 | zero results |
| sq0149 | restaurant | humus בפאפוס | restaurant | Paphos | Paphos | /restaurants/316?type=parve&useUserGps=true&q=hummus+%D7%91%D7%A4%D7%90%D7%A4%D7%95%D7%A1 | 200 | 0 | zero results |
| sq0151 | restaurant | איפה אפשר לאכול fish בברלין? | restaurant | - | Berlin | /restaurants/483?type=parve&useUserGps=true&q=%D7%90%D7%99%D7%A4%D7%94+%D7%90%D7%A4%D7%A9%D7%A8+%D7%9C%D7%90%D7%9B%D7%95%D7%9C+fish+%D7%91%D7%91%D7%A8%D7%9C%D7%99%D7%9F%3F | 200 | 0 | zero results |
| sq0154 | restaurant | hamburger באנטוורפן | restaurant | - | - | - | 201 | 0 | zero results |
| sq0156 | restaurant | פלפל מהדרין ברומא | restaurant | Rome | Rome | /restaurants/373?type=parve&useUserGps=true&q=%D7%A4%D7%9C%D7%90%D7%A4%D7%9C+%D7%9E%D7%94%D7%93%D7%A8%D7%99%D7%9F+%D7%91%D7%A8%D7%95%D7%9E%D7%90 | 200 | 0 | zero results |
| sq0161 | restaurant | מחפש גלידה כשר באנטוורפן | restaurant | - | - | - | 201 | 0 | zero results |
| sq0162 | restaurant | אני נמצא בישראל ורוצה fish בפורטו | restaurant | - | Porto | /restaurants/297?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%A0%D7%9E%D7%A6%D7%90+%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%95%D7%A8%D7%95%D7%A6%D7%94+fish+%D7%91%D7%A4%D7%95%D7%A8%D7%98%D7%95 | 200 | 0 | zero results |
| sq0169 | restaurant | מחפש פיש כשר במילאנו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0177 | restaurant | looking for פלפל near me in Vienna | restaurant | Vienna | Vienna | /restaurants/484?type=parve&useUserGps=true&q=looking+for+%D7%A4%D7%9C%D7%90%D7%A4%D7%9C+near+me+in+Vienna | 200 | 0 | zero results |
| sq0203 | restaurant | מחפש fish כשר באנטוורפן | restaurant | - | - | - | 201 | 0 | zero results |
| sq0214 | restaurant | looking for fish near me in Miami | restaurant | Miami | Miami | /restaurants/464?type=parve&useUserGps=true&q=looking+for+fish+near+me+in+Miami | 200 | 0 | zero results |
| sq0220 | restaurant | גליד מהדרין במילאנו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0221 | restaurant | אני נמצא בישראל ורוצה sushi בקוסמוי | restaurant | - | Ko Samui | /restaurants/472?type=parve&useUserGps=true&q=%D7%90%D7%A0%D7%99+%D7%A0%D7%9E%D7%A6%D7%90+%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%95%D7%A8%D7%95%D7%A6%D7%94+sushi+%D7%91%D7%A7%D7%95%D7%A1%D7%9E%D7%95%D7%99 | 200 | 0 | zero results |
| sq0224 | restaurant | מחפש מאפיה כשר באנטוורפן | restaurant | - | - | - | 201 | 0 | zero results |
| sq0226 | restaurant | גליד בציריך | restaurant | - | - | - | 201 | 0 | zero results |
| sq0227 | restaurant | hummus במילאנו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0237 | restaurant | kosher פלפל in Madrid | restaurant | - | - | - | 201 | 0 | zero results |
| sq0239 | restaurant | מחפש שווארמה כשר במילאנו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0242 | restaurant | אני נמצא בישראל ורוצה shawarma בטורונטו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0246 | restaurant | looking for פלאפל near me in Buenos Aires | restaurant | Buenos Aires | Buenos Aires | /restaurants/478?type=parve&useUserGps=true&q=looking+for+%D7%A4%D7%9C%D7%90%D7%A4%D7%9C+near+me+in+Buenos+Aires | 200 | 0 | zero results |
| sq0248 | restaurant | looking for פלפל near me in Marrakech | restaurant | Marrakech | Marrakech | /restaurants/375?type=parve&useUserGps=true&q=looking+for+%D7%A4%D7%9C%D7%90%D7%A4%D7%9C+near+me+in+Marrakech | 200 | 0 | zero results |
| sq0249 | restaurant | מחפש דגים כשר בטורונטו | restaurant | - | - | - | 201 | 0 | zero results |
| sq0254 | restaurant | גליד באתונה | restaurant | - | - | - | 201 | 0 | zero results |
| sq0255 | restaurant | looking for fish near me in Larnaca | restaurant | Larnaca | Larnaca | /restaurants/363?type=parve&useUserGps=true&q=looking+for+fish+near+me+in+Larnaca | 200 | 0 | zero results |
| sq0256 | restaurant | אני נמצא בישראל ורוצה fish בז׳נבה | restaurant | - | - | - | 201 | 0 | zero results |
| sq0259 | restaurant | pasta מהדרין באתונה | restaurant | - | - | - | 201 | 0 | zero results |
| sq0269 | restaurant | falafel place מהדרין ברומא | restaurant | Rome | Rome | /restaurants/373?type=parve&useUserGps=true&q=falafel+place+%D7%9E%D7%94%D7%93%D7%A8%D7%99%D7%9F+%D7%91%D7%A8%D7%95%D7%9E%D7%90 | 200 | 0 | zero results |
| sq0271 | restaurant | kosher פלאפל in Buenos Aires | restaurant | Buenos Aires | Buenos Aires | /restaurants/478?type=parve&useUserGps=true&q=kosher+%D7%A4%D7%9C%D7%90%D7%A4%D7%9C+in+Buenos+Aires | 200 | 0 | zero results |
| sq0273 | restaurant | המבורגר מהדרין בציריך | restaurant | - | - | - | 201 | 0 | zero results |
| sq0276 | restaurant | חומוס מהדרין בלונדון | restaurant | London | London | /restaurants/333?type=parve&useUserGps=true&q=%D7%97%D7%95%D7%9E%D7%95%D7%A1+%D7%9E%D7%94%D7%93%D7%A8%D7%99%D7%9F+%D7%91%D7%9C%D7%95%D7%A0%D7%93%D7%95%D7%9F | 200 | 0 | zero results |
| sq0282 | restaurant | מחפש פיש כשר באתונה | restaurant | - | - | - | 201 | 0 | zero results |
| sq0283 | restaurant | אני נמצא בישראל ורוצה גלידה באתונה | restaurant | - | - | - | 201 | 0 | zero results |

## Top Failed Notes

- pareve: 61
- dairy: 30
- meat: 19
- fish: 18
- hummus: 17
- falafel: 17
- ice-cream: 12
- pizza: 10
- burger: 10
- sushi: 9
- ambiguous: 8
- steak: 5
- bakery: 4
- shawarma: 4
- pasta: 4
- fake_destination: 4

## What To Fix First

- Fix category/routing failures first. These are cases where the user is sent to the wrong screen.
- Fix destination failures next. These are cases where the intent is right but the user lands in the wrong place.
- Then review result failures. Some are real bugs, but some may simply mean the DB has no data for that destination/category.

## Notes

- `unknown` cases pass when the system safely avoids routing to a confident wrong result.
- Result checks require auth for guarded endpoints. If many result failures have status 401, rerun with `BENCH_TOKEN` or `BENCH_EMAIL/BENCH_PASSWORD`.
- A zero-result failure is not always a parser bug; it can be missing data or overly strict filtering.
