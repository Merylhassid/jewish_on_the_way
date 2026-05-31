-- Check all destinations with synagogue counts, ordered by count desc
SELECT d.id, d.name, COUNT(s.id) as synagogue_count
FROM destinations d
LEFT JOIN synagogues s ON s."destinationId" = d.id
GROUP BY d.id, d.name
HAVING COUNT(s.id) > 0
ORDER BY synagogue_count DESC
LIMIT 30;
