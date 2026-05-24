-- Find synagogues with קרית in their address
SELECT s.id, s.name, s.address, s."destinationId", d.name as dest_name
FROM synagogues s
LEFT JOIN destinations d ON d.id = s."destinationId"
WHERE s.address ILIKE '%קרית%'
ORDER BY s."destinationId", s.id
LIMIT 30;
