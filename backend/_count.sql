SELECT COUNT(*) AS total_restaurants,
       COUNT(*) FILTER (WHERE tags IS NOT NULL AND array_length(tags,1) > 0) AS with_tags,
       COUNT(DISTINCT "destinationId") AS destinations
FROM restaurants;
