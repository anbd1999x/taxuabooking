-- CreateTable
CREATE TABLE "FleetVehicle" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "rentalVehicleId" TEXT,
    "name" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ga',
    "color" TEXT,
    "year" INTEGER,
    "odo" INTEGER NOT NULL DEFAULT 0,
    "pricePerDay" DECIMAL(12,0) NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'good',
    "mode" TEXT NOT NULL DEFAULT 'ready',
    "note" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetRental" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "bookingId" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cccd" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "total" DECIMAL(12,0) NOT NULL,
    "deposit" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "place" TEXT,
    "source" TEXT NOT NULL DEFAULT 'Web',
    "note" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetRental_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FleetVehicle_serviceId_idx" ON "FleetVehicle"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_serviceId_plate_key" ON "FleetVehicle"("serviceId", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "FleetRental_code_key" ON "FleetRental"("code");

-- CreateIndex
CREATE INDEX "FleetRental_vehicleId_startDate_idx" ON "FleetRental"("vehicleId", "startDate");

-- CreateIndex
CREATE INDEX "FleetRental_bookingId_idx" ON "FleetRental"("bookingId");

-- AddForeignKey
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetRental" ADD CONSTRAINT "FleetRental_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetRental" ADD CONSTRAINT "FleetRental_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

