ALTER TABLE "Assessment"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "feedback" JSONB,
  ALTER COLUMN "result" DROP NOT NULL;

UPDATE "Assessment"
SET "status" = 'ready',
    "feedback" = "result"->'candidateFeedback',
    "result" = "result" - 'candidateFeedback'
WHERE "result" IS NOT NULL;
