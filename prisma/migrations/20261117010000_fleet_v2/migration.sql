-- AlterTable
ALTER TABLE "FleetRental" ADD COLUMN     "ctvName" TEXT,
ADD COLUMN     "fees" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "hand" JSONB,
ADD COLUMN     "ret" JSONB,
ADD COLUMN     "webPending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FleetVehicle" ADD COLUMN     "insuranceExp" DATE,
ADD COLUMN     "lastOilOdo" INTEGER,
ADD COLUMN     "oilEvery" INTEGER NOT NULL DEFAULT 2000;

-- CreateTable
CREATE TABLE "FleetPayment" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,0) NOT NULL,
    "method" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "by" TEXT,

    CONSTRAINT "FleetPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetServiceLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "what" TEXT NOT NULL,
    "cost" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "odo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetConfig" (
    "serviceId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetConfig_pkey" PRIMARY KEY ("serviceId")
);

-- CreateIndex
CREATE INDEX "FleetPayment_rentalId_idx" ON "FleetPayment"("rentalId");

-- CreateIndex
CREATE INDEX "FleetPayment_at_idx" ON "FleetPayment"("at");

-- CreateIndex
CREATE INDEX "FleetServiceLog_vehicleId_idx" ON "FleetServiceLog"("vehicleId");

-- AddForeignKey
ALTER TABLE "FleetPayment" ADD CONSTRAINT "FleetPayment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "FleetRental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetServiceLog" ADD CONSTRAINT "FleetServiceLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetConfig" ADD CONSTRAINT "FleetConfig_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

