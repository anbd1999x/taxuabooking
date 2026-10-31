-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CTV', 'PROVIDER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "ctvId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "BookingRequest_ctvId_idx" ON "BookingRequest"("ctvId");

-- CreateIndex
CREATE INDEX "BookingRequest_paymentStatus_idx" ON "BookingRequest"("paymentStatus");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_ctvId_fkey" FOREIGN KEY ("ctvId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
