-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "bikeAmount" DECIMAL(12,0),
ADD COLUMN     "bikeCount" INTEGER,
ADD COLUMN     "bikeFrom" DATE,
ADD COLUMN     "bikePickup" TEXT,
ADD COLUMN     "bikeReturn" TEXT,
ADD COLUMN     "bikeTo" DATE,
ADD COLUMN     "bikeType" TEXT;

