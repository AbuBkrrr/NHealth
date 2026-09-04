-- sql/detect_duplicate_phones.sql
-- Run this against your Postgres DB to find users with duplicate phone numbers

-- 1) Show duplicate phone numbers and counts
SELECT phone, COUNT(*) AS cnt
FROM "User"
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- 2) List affected user rows for manual review
SELECT id, email, phone, name, role, "createdAt"
FROM "User"
WHERE phone IN (
  SELECT phone
  FROM "User"
  WHERE phone IS NOT NULL
  GROUP BY phone
  HAVING COUNT(*) > 1
)
ORDER BY phone, "createdAt";

-- 3) OPTIONAL: Preview a safe UPDATE that nulls duplicate phones except the oldest
-- WARNING: run on staging first. This is a destructive operation—review before running.
-- The following will set phone = NULL for all but the earliest-created user per phone
-- Uncomment to run.

-- WITH ranked AS (
--   SELECT id, phone, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY "createdAt" ASC) AS rn
--   FROM "User"
--   WHERE phone IS NOT NULL
-- )
-- UPDATE "User" u
-- SET phone = NULL
-- FROM ranked r
-- WHERE u.id = r.id AND r.rn > 1;
