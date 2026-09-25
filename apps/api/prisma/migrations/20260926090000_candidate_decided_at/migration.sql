-- AlterTable: the date the commission decided, reported by inVision; never the decision.
ALTER TABLE "Candidate" ADD COLUMN "decidedAt" TIMESTAMP(3);
