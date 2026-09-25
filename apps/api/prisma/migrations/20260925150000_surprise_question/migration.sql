-- CreateTable
CREATE TABLE "SurpriseQuestion" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "question" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "answerSeconds" INTEGER NOT NULL DEFAULT 90,
    "startedAt" TIMESTAMP(3),
    "answerDeadline" TIMESTAMP(3),
    "videoRef" TEXT,
    "segments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurpriseQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurpriseQuestion_candidateId_key" ON "SurpriseQuestion"("candidateId");

-- AddForeignKey
ALTER TABLE "SurpriseQuestion" ADD CONSTRAINT "SurpriseQuestion_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
