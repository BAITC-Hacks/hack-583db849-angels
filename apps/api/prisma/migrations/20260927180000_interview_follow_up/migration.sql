CREATE TABLE "InterviewFollowUp" (
    "id" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "question" TEXT,
    "segments" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InterviewFollowUp_interviewId_createdAt_idx" ON "InterviewFollowUp"("interviewId", "createdAt");

ALTER TABLE "InterviewFollowUp" ADD CONSTRAINT "InterviewFollowUp_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
