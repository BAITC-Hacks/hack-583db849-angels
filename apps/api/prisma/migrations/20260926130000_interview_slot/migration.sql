-- CreateTable
CREATE TABLE "InterviewSlot" (
    "id" UUID NOT NULL,
    "interviewerRef" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "candidateId" UUID,
    "bookedAt" TIMESTAMP(3),
    "candidateJoinedAt" TIMESTAMP(3),
    "interviewerJoinedAt" TIMESTAMP(3),
    "consentRecording" BOOLEAN NOT NULL DEFAULT false,
    "interviewId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSlot_interviewId_key" ON "InterviewSlot"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewSlot_startsAt_idx" ON "InterviewSlot"("startsAt");

-- CreateIndex
CREATE INDEX "InterviewSlot_candidateId_startsAt_idx" ON "InterviewSlot"("candidateId", "startsAt");

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

