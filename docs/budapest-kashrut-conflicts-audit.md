# Budapest Kashrut Conflict Audit

Status: review only. Do not import, seed, or overwrite database values from this file.

## Purpose

Budapest already exists in the database. This file is for comparing the existing database values against the new Budapest launch script and the user-provided screenshots/links before any write is approved.

If the script conflicts with an existing database value, keep the database value by default and mark the row for manual review. Do not overwrite a verified database record from a fuzzy name match.

## Review Rules

1. Match venues by Google place ID first, then exact Maps URL, then phone plus city, then exact normalized name plus address.
2. Keep restaurant type separate from kashrut level.
3. Put restaurant notes, warnings, tips, and screenshot-only comments in `about` or verification notes, not in the kashrut field.
4. Do not attach hotel ratings or generic hotel details to a restaurant unless the restaurant itself has a direct listing.
5. For Chabad-owned venues, umbrella Chabad ratings/reviews are acceptable only when ownership is clear.
6. No database write is allowed until the conflict decision is reviewed.

## Conflict Table

| # | Venue | Screenshot / User Source Kashrut | Current DB Kashrut | Script Kashrut | Conflict? | Decision |
|---|---|---|---|---|---|---|
| 1 | CAFE TAMAR / קפה תמר | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 2 | TEL AVIV CAFE / קפה תל אביב | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 3 | BROOKLYN BAGEL / ברוקלין בייגל | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 4 | MARRAKESH / מסעדת מרקש | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 5 | SHUK HACARMEL / שוק הכרמל | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 6 | HUMMUSBAR / חומוס בר | בד"ץ חוג חתם סופר פתח תקוה | TODO | TODO | TODO | TODO |
| 7 | NITAVALO / מסעדת ניטאבלו | בד"ץ תפארת ישראל בראשות הרב הראל אשר זיידי | TODO | TODO | TODO | TODO |
| 8 | HANNA / מסעדת חנה | בהשגחת מערכת הכשרות CRC שע"י התאחדות הרבנים דארה"ב וקנדה | TODO | TODO | TODO | TODO |
| 9 | CARMEL / מסעדת כרמל | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 10 | FALAFEL BAR / פלאפל בר | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 11 | ASHIS / מסעדת אשיז | בהשגחת הרב נחמיה רוטנברג | TODO | TODO | TODO | TODO |
| 12 | UpTown Kosher bakery / מאפיית שמש | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 13 | Slow Moe's Kosher Bakery | בהשגחת הרב ברוך אוברלנדר, חב"ד בודפשט | TODO | TODO | TODO | TODO |
| 14 | Koser Piac / Kosher Market / חנות כשרה | TODO - screenshot has store details but no explicit kashrut line captured here | TODO | TODO | TODO | TODO |

## Per-Venue Notes

Use this section for explanations that should not be stored as kashrut level.

| # | About / Notes From Screenshot | Should Go To |
|---|---|---|
| 1 | Italian dairy kosher restaurant in Budapest's Jewish quarter. Breakfast is available. | about |
| 2 | Cafe/restaurant in the Jewish center of Budapest. Offers pizza, pasta, fish, salads, and takeaway/catering notes. | about |
| 3 | Dairy kosher restaurant near Margaret Island and close to Chabad's synagogue. | about |
| 4 | Authentic Moroccan restaurant in the Jewish quarter. | about |
| 5 | Fast food from the creator of Carmel, including shawarma, schnitzel, hummus, falafel and more. | about |
| 6 | Israeli hummus chain branch in Budapest, serving hummus, falafel, sabich, shakshuka and more. | about |
| 7 | Kosher chef restaurant by Aharon Feigen. | about |
| 8 | Jewish-style restaurant in the Jewish quarter with Shabbat meals by advance reservation. | about |
| 9 | Classic Jewish/Hungarian kosher meat restaurant in the Jewish quarter. Includes Shabbat meal notes by reservation. | about |
| 10 | Falafel and fast food near Cafe Tamar. | about |
| 11 | Street-food style restaurant offering falafel, hummus, schnitzel, burger and more. | about |
| 12 | Kosher bakery in the Jewish quarter with breads, challah, cakes and Hungarian pastries. | about |
| 13 | Kosher bakery from the 7seasons group. | about |
| 14 | Kosher grocery/store in the Jewish quarter, including Israeli products. | about / category tag |

## Fields To Compare

For every venue, compare these fields before approving any update:

| Field | Existing DB | Script | Source To Trust First | Notes |
|---|---|---|---|---|
| name | TODO | TODO | Google / existing DB | Proper names should remain recognizable. |
| address | TODO | TODO | Google Maps | Prefer canonical Google address. |
| phone | TODO | TODO | Google Maps / official site | Keep international format. |
| website | TODO | TODO | Official venue site | Do not replace specific venue site with generic source. |
| googleMapsUrl | TODO | TODO | Resolved Google URL | Must point to the same venue. |
| rating | TODO | TODO | Direct Google listing | Do not use unrelated umbrella listing unless approved. |
| reviewCount | TODO | TODO | Direct Google listing | Same attribution rule as rating. |
| restaurantType | TODO | TODO | Screenshot / official venue | Dairy/meat/pareve/market type, not kosher authority. |
| kashrutLevel | TODO | TODO | Official source / screenshot / existing DB | Manual review on conflict. |
| about | TODO | TODO | Screenshot / official site | Notes and tips belong here. |

## Approval Log

| Date | Reviewer | Scope Approved | Notes |
|---|---|---|---|
| TODO | TODO | TODO | TODO |
