-- AlterTable
ALTER TABLE "CabinPriceRow" ADD COLUMN     "serviceId" TEXT;

-- CreateIndex
CREATE INDEX "CabinPriceRow_serviceId_idx" ON "CabinPriceRow"("serviceId");

-- AddForeignKey
ALTER TABLE "CabinPriceRow" ADD CONSTRAINT "CabinPriceRow_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
