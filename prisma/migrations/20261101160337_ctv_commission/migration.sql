-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "commissionPerOrder" DECIMAL(12,0);

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "commissionAmount" DECIMAL(12,0),
ADD COLUMN     "commissionPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commissionPaidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "ctvCommission" DECIMAL(12,0);

