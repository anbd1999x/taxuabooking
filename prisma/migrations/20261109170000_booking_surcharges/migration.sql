-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN "surcharges" JSONB NOT NULL DEFAULT '[]';
