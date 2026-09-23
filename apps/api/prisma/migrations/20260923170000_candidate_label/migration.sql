ALTER TABLE "Candidate" ADD COLUMN "label" TEXT;

UPDATE "Candidate"
SET "label" = 'Candidate ' || UPPER(LEFT(REPLACE("id"::text, '-', ''), 8));

ALTER TABLE "Candidate" ALTER COLUMN "label" SET NOT NULL;
