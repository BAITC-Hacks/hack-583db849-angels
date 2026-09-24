ALTER TABLE "Simulation"
  ADD COLUMN "scenario" JSONB,
  ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'opening',
  ADD COLUMN "ending" TEXT,
  ADD COLUMN "accommodation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "turnInFlight" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Simulation" SET "stage" = 'finished', "ending" = 'completed' WHERE "status" = 'completed';

ALTER TABLE "SimulationTurn"
  ADD COLUMN "recognitionConfidence" DOUBLE PRECISION,
  ADD COLUMN "audioPath" TEXT,
  ADD COLUMN "director" JSONB;

CREATE TABLE "Accommodation" (
  "id" UUID NOT NULL,
  "candidateId" UUID NOT NULL,
  "textMode" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT NOT NULL,
  "setByRole" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Accommodation_candidateId_key" ON "Accommodation"("candidateId");
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Simulation" GROUP BY "candidateId" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Existing candidates have multiple simulations; resolve duplicates without deleting data before applying this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Simulation_candidateId_key" ON "Simulation"("candidateId");
