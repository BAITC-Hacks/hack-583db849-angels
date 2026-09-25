-- CreateTable
CREATE TABLE "Presentation" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'transcribing',
    "durationSec" DOUBLE PRECISION NOT NULL,
    "videoRef" TEXT,
    "segments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Presentation_candidateId_key" ON "Presentation"("candidateId");

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
