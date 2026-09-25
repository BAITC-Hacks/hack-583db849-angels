-- AlterTable
ALTER TABLE "Interview" ADD COLUMN "interviewerRef" TEXT;
ALTER TABLE "Interview" ADD COLUMN "transcriptStatus" TEXT NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "InterviewDraft" (
    "id" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interview_candidateId_createdAt_idx" ON "Interview"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewDraft_interviewId_createdAt_idx" ON "InterviewDraft"("interviewId", "createdAt");

-- AddForeignKey
ALTER TABLE "InterviewDraft" ADD CONSTRAINT "InterviewDraft_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
