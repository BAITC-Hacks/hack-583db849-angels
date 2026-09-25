-- AlterTable: every check says which kind it is, so the list can be filtered.
ALTER TABLE "QualityCheck" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'interview';
ALTER TABLE "QualityCheck" ALTER COLUMN "kind" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "QualityCheck_kind_createdAt_idx" ON "QualityCheck"("kind", "createdAt");
