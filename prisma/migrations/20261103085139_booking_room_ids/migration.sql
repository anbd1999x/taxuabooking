-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "roomIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
