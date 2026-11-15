-- Taxi / xe ôm: nhiều tuyến cho một dịch vụ.
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "fromPoint" TEXT NOT NULL,
    "toPoint" TEXT NOT NULL,
    "price" DECIMAL(12,0),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TransportRoute_serviceId_idx" ON "TransportRoute"("serviceId");
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingRequest" ADD COLUMN "transportRouteId" TEXT;
