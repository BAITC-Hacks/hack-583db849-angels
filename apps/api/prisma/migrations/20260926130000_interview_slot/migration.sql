Scope: all 5 workspace projects
✓ Lockfile passes supply-chain policies (verified 2d ago)
../..                                    | Progress: resolved 1, reused 0, downloaded 0, added 0
../..                                    |    +1016 ++++++++++++++++++++++++++++
Packages are cloned from the content-addressable store to the virtual store.
  Content-addressable store is at: /Users/meiyrbek/Library/pnpm/store/v11
  Virtual store is at:             ../../node_modules/.pnpm
../..                                    | Progress: resolved 1016, reused 1014, downloaded 0, added 61
../..                                    | Progress: resolved 1016, reused 1014, downloaded 0, added 237
../..                                    | Progress: resolved 1016, reused 1014, downloaded 0, added 535
../..                                    | Progress: resolved 1016, reused 1014, downloaded 0, added 898
../..                                    | Progress: resolved 1016, reused 1014, downloaded 0, added 1015
../..                                    | Progress: resolved 1016, reused 1014, downloaded 0, added 1016, done
.../node_modules/unrs-resolver postinstall$ node postinstall.js
.../node_modules/unrs-resolver postinstall: Done
.../node_modules/prisma preinstall$ node scripts/preinstall-entry.js
.../node_modules/prisma preinstall: Done
.../node_modules/@prisma/client postinstall$ node scripts/postinstall.js
.../node_modules/@prisma/client postinstall: prisma:warn We could not find your Prisma schema in the default locations (see: https://pris.ly/d/prisma-schema-location).
.../node_modules/@prisma/client postinstall: If you have a Prisma schema file in a custom path, you will need to run
.../node_modules/@prisma/client postinstall: `prisma generate --schema=./path/to/your/schema.prisma` to generate Prisma Client.
.../node_modules/@prisma/client postinstall: If you do not have a Prisma schema file yet, you can ignore this message.
.../node_modules/@prisma/client postinstall: Done

dependencies:
+ @nestjs/common 11.1.12
+ @nestjs/config 4.0.2
+ @nestjs/core 11.1.12
+ @nestjs/platform-express 11.1.12
+ @nestjs/swagger 11.2.6
+ @prisma/client 6.19.3
+ class-transformer 0.5.1
+ class-validator 0.14.2
+ openapi-fetch 0.17.0
+ reflect-metadata 0.2.2
+ rxjs 7.8.2

devDependencies:
+ @eslint/js 9.39.5
+ @nestjs/cli 11.0.12
+ @nestjs/testing 11.1.12
+ @types/express 5.0.5
+ @types/jest 30.0.0
+ @types/node 24.13.5
+ @types/supertest 6.0.3
+ eslint 9.39.5
+ jest 30.2.0
+ openapi-typescript 7.13.0
+ prisma 6.19.3
+ supertest 7.1.4
+ ts-jest 29.4.6
+ ts-node 10.9.2
+ typescript 5.9.3
+ typescript-eslint 8.56.1

Done in 10.9s using pnpm v11.20.0
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

