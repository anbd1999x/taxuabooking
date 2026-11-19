ALTER TABLE "DineRequest" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "DineRequest" ADD COLUMN "claimAmount" DECIMAL(12,0);
ALTER TABLE "DineRequest" ADD COLUMN "proofUrl" TEXT;
ALTER TABLE "DineRequest" ADD COLUMN "claimNote" TEXT;
