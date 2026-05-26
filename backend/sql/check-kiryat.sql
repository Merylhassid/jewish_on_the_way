SELECT d.id, d.name, COUNT(s.id) as synagogue_count
FROM destinations d
LEFT JOIN synagogues s ON s."destinationId" = d.id
WHERE d.name ILIKE '%קרית%' OR d.id IN (444, 446)
GROUP BY d.id, d.name
ORDER BY d.id;
