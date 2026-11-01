-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'DEPOSITED';

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "amountCollected" DECIMAL(12,0);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "commission" DECIMAL(12,0),
ADD COLUMN     "commissionFri" DECIMAL(12,0),
ADD COLUMN     "commissionMon" DECIMAL(12,0),
ADD COLUMN     "commissionSat" DECIMAL(12,0),
ADD COLUMN     "commissionSun" DECIMAL(12,0),
ADD COLUMN     "commissionThu" DECIMAL(12,0),
ADD COLUMN     "commissionTue" DECIMAL(12,0),
ADD COLUMN     "commissionWed" DECIMAL(12,0);

