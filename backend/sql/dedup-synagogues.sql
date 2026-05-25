-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Preview duplicates before deleting
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  "normalizedName",
  COUNT(*)                   AS total_copies,
  array_agg(id ORDER BY id)  AS all_ids,
  array_agg(address ORDER BY id) AS all_addresses
FROM synagogues
WHERE destination_id = 348
GROUP BY "normalizedName"
HAVING COUNT(*) > 1
ORDER BY total_copies DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: For each duplicate group, pick the record to KEEP:
--   Priority 1 → has "תל אביב" in address
--   Priority 2 → highest id (most recent)
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM synagogues
WHERE destination_id = 348
  AND id NOT IN (
    SELECT DISTINCT ON (COALESCE("normalizedName", id::text))
      id
    FROM synagogues
    WHERE destination_id = 348
    ORDER BY
      COALESCE("normalizedName", id::text),
      CASE WHEN address LIKE '%תל אביב%' THEN 0 ELSE 1 END ASC,  -- prefer תל אביב address
      id DESC                                                       -- then prefer latest
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Verify — should return 0 rows
-- ─────────────────────────────────────────────────────────────────────────────
SELECT "normalizedName", COUNT(*) AS copies
FROM synagogues
WHERE destination_id = 348
GROUP BY "normalizedName"
HAVING COUNT(*) > 1;
