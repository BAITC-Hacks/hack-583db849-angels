-- CreateTable
CREATE TABLE "Brief" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Brief_candidateId_createdAt_idx" ON "Brief"("candidateId", "createdAt");

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

