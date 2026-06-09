UPDATE restaurants SET kashrut_level = 'mehadrin'
WHERE kashrut_level = 'rabbinate'
  AND (name LIKE '%מהדרין%' OR name LIKE '%למהדרין%');

UPDATE restaurants SET kashrut_level = 'badatz'
WHERE kashrut_level != 'badatz'
  AND (name LIKE '%בד"ץ%' OR name LIKE '%בד״ץ%' OR name LIKE '%בדץ%');

SELECT kashrut_level, COUNT(*) AS total
FROM restaurants
GROUP BY kashrut_level
ORDER BY kashrut_level;
