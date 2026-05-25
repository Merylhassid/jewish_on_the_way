# Synagogue Import Files

כל קבצי ה-JSON לייבוא בתי כנסת. נטענים דרך:

```powershell
$token = (Invoke-RestMethod -Uri "http://49.12.189.108:3000/auth/login" `
  -Method Post -ContentType "application/json" `
  -Body '{"email":"daniyehudai@gmail.com","password":"daniel2109"}').access_token

$data = Get-Content "backend/imports/import-CITYNAME-synagogues.json" -Raw -Encoding UTF8

$result = Invoke-RestMethod -Uri "http://49.12.189.108:3000/admin/synagogues/bulk" `
  -Method Post -ContentType "application/json; charset=utf-8" `
  -Headers @{Authorization="Bearer $token"} -Body $data

"created=$($result.created) updated=$($result.updated) skipped=$($result.skipped) errors=$($result.errors)"
```

## מבנה

| תיקייה | תוכן |
|--------|------|
| `imports/` | קבצי JSON מוכנים לייבוא (פורמט אחיד) |
| `imports/legacy/` | סקריפטי PowerShell ישנים עם נתונים מוטמעים |

## קונבנציית שמות

`import-{city-name}-synagogues.json`

לדוגמה:
- `import-yavne-synagogues.json`
- `import-new-york-synagogues.json`
- `import-new-york-synagogues-chabad.json` (מקור נפרד לאותה עיר)
