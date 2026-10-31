-- DropIndex
DROP INDEX "CabinTrip_serviceId_departureDate_idx";

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "cabinReturnTripId" TEXT,
ADD COLUMN     "seatsDouble" INTEGER,
ADD COLUMN     "seatsSingle" INTEGER;

-- AlterTable
ALTER TABLE "CabinTrip" ADD COLUMN     "direction" "CabinDirection" NOT NULL DEFAULT 'OUTBOUND',
ADD COLUMN     "priceDouble" DECIMAL(12,0),
ADD COLUMN     "seatsDoubleAvailable" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seatsDoubleTotal" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "CabinTrip_serviceId_departureDate_direction_idx" ON "CabinTrip"("serviceId", "departureDate", "direction");
