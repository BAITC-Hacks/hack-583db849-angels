UPDATE "Candidate"
SET "label" = CASE "externalId"
  WHEN 'inv-2026-demo-a' THEN 'Candidate A'
  WHEN 'inv-2026-demo-b' THEN 'Candidate B'
  WHEN 'inv-2026-demo-c' THEN 'Candidate C'
  ELSE 'Candidate ' || UPPER(RIGHT("externalId", 4))
END
WHERE "label" = 'Candidate ' || UPPER(LEFT(REPLACE("id"::text, '-', ''), 8));
