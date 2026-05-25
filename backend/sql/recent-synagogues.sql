SELECT s.id, s.name, s.address, s."destinationId", d.name as dest_name, s.created_at
FROM synagogues s
LEFT JOIN destinations d ON d.id = s."destinationId"
ORDER BY s.created_at DESC
LIMIT 20;
