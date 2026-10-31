-- CreateEnum
CREATE TYPE "CabinDirection" AS ENUM ('OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "CabinTicketType" AS ENUM ('ROUND_TRIP', 'OUTBOUND', 'RETURN');

-- AlterTable
ALTER TABLE "CabinPriceRow" ADD COLUMN     "ticketType" "CabinTicketType" NOT NULL DEFAULT 'ROUND_TRIP';

-- CreateTable
CREATE TABLE "CabinRoute" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "direction" "CabinDirection" NOT NULL,
    "title" TEXT,
    "totalTime" TEXT,
    "startLabel" TEXT,
    "startInfo" TEXT,
    "fromPoint" TEXT,
    "toPoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CabinRouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "note" TEXT,
    "tag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinRouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CabinRoute_serviceId_direction_key" ON "CabinRoute"("serviceId", "direction");

-- CreateIndex
CREATE INDEX "CabinRouteStop_routeId_idx" ON "CabinRouteStop"("routeId");

-- AddForeignKey
ALTER TABLE "CabinRoute" ADD CONSTRAINT "CabinRoute_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CabinRouteStop" ADD CONSTRAINT "CabinRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CabinRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
