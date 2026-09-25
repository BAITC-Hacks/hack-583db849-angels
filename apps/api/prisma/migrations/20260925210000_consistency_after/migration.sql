-- CreateTable
CREATE TABLE "ConsistencyReport" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "interviewId" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsistencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsistencyReport_candidateId_createdAt_idx" ON "ConsistencyReport"("candidateId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsistencyReport" ADD CONSTRAINT "ConsistencyReport_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsistencyReport" ADD CONSTRAINT "ConsistencyReport_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
