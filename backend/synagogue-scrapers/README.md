# Rabanut Synagogue Scraper

Playwright-based scraper for the Israeli Chief Rabbinate synagogue directory (rabanut.co.il).

## Setup – PowerShell

```powershell
cd backend\rabanut-scraper
npm install
npx playwright install chromium
```

## Running

```powershell
# Standard run (headless, production)
node scrape.js

# Headed mode – see the browser in action (useful for debugging selectors)
node scrape.js --headed

# Debug mode – dumps the first list page HTML to debug-page.html then exits
# Use this if output looks wrong, to inspect the real DOM selectors
node scrape.js --debug

# Resume an interrupted run (skips already-scraped URLs)
node scrape.js --resume
```

## Output

| File | Description |
|------|-------------|
| `synagogues.json` | Final output – all scraped synagogues |
| `progress.json`   | Auto-saved progress (deleted on clean completion) |
| `debug-page.html` | Raw HTML dump (only when `--debug` is used) |

### synagogues.json structure

```json
{
  "scraped_at": "2026-05-13T10:00:00.000Z",
  "total": 450,
  "source": "https://rabanut.co.il/...",
  "synagogues": [
    {
      "url": "https://rabanut.co.il/...",
      "name": "שם בית הכנסת",
      "address": "רחוב הרצל 1",
      "city": "תל אביב",
      "neighborhood": "נווה צדק",
      "phone": "03-1234567",
      "nusach": "אשכנז",
      "rabbi": "הרב ישראל ישראלי",
      "gabbai": null,
      "hours": "שחרית 07:00, מנחה 19:30",
      "notes": null,
      "raw_fields": {
        "כתובת": "רחוב הרצל 1",
        "...": "..."
      }
    }
  ]
}
```

The `raw_fields` object contains **every** label-value pair found on the page,
even ones that weren't mapped to the structured fields. Useful for discovering
additional fields the site exposes.

## Troubleshooting

**"0 synagogue URLs found"**
→ Run with `--debug` to dump the HTML, then open `debug-page.html` in a browser
and inspect the actual CSS selectors. Update `isInternalSynagogueUrl()` or the
`excluded` selector list in `scrapeListPage()` accordingly.

**"domcontentloaded timeout"**
→ The site may be slow. Increase `DELAY_LIST_PAGE` and `DELAY_DETAIL_PAGE`
constants at the top of `scrape.js`.

**Empty fields in output**
→ The detail page layout may differ from expected. Run with `--headed --debug`
to inspect one page manually, then add/adjust selectors in `scrapeDetailPage()`.
The `raw_fields` object always shows what was actually found.
