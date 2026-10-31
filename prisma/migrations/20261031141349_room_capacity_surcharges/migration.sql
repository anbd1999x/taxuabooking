-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "earlyCheckinFee" DECIMAL(12,0),
ADD COLUMN     "extraPersonFee" DECIMAL(12,0),
ADD COLUMN     "lateCheckoutFee" DECIMAL(12,0),
ADD COLUMN     "maxCapacity" INTEGER;
