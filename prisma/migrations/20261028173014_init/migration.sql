-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('CABIN', 'HOMESTAY', 'BUNGALOW', 'MOTORBIKE', 'XEOM', 'TAXI', 'COMBO');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'SOLD_OUT', 'NOT_UPDATED', 'PENDING_CONFIRM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('NEW', 'CONTACTING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area" TEXT,
    "basePrice" DECIMAL(12,0),
    "priceUnit" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactZalo" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceImage" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "weekdayPrice" DECIMAL(12,0) NOT NULL,
    "weekendPrice" DECIMAL(12,0) NOT NULL,
    "holidayPrice" DECIMAL(12,0),
    "totalRooms" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAvailability" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "availableRooms" INTEGER NOT NULL DEFAULT 0,
    "priceOverride" DECIMAL(12,0),
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'NOT_UPDATED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CabinTrip" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "departureDate" DATE NOT NULL,
    "departureTime" TEXT NOT NULL,
    "pickupPoint" TEXT NOT NULL,
    "dropoffPoint" TEXT NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "seatsTotal" INTEGER NOT NULL DEFAULT 0,
    "seatsAvailable" INTEGER NOT NULL DEFAULT 0,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalVehicle" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "pricePerDay" DECIMAL(12,0) NOT NULL,
    "totalUnits" INTEGER NOT NULL DEFAULT 1,
    "deliveryFee" DECIMAL(12,0),
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalAvailability" (
    "id" TEXT NOT NULL,
    "rentalVehicleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "availableUnits" INTEGER NOT NULL DEFAULT 0,
    "priceOverride" DECIMAL(12,0),
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'NOT_UPDATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportInfo" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "fromPoint" TEXT NOT NULL,
    "toArea" TEXT NOT NULL,
    "vehicleType" TEXT,
    "fixedPrice" DECIMAL(12,0),
    "priceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "serviceId" TEXT,
    "serviceTitle" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "useDate" DATE NOT NULL,
    "endDate" DATE,
    "nights" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "roomTypeId" TEXT,
    "cabinTripId" TEXT,
    "rentalVehicleId" TEXT,
    "selectionLabel" TEXT,
    "referencePrice" DECIMAL(12,0),
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "status" "BookingStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_category_published_idx" ON "Service"("category", "published");

-- CreateIndex
CREATE INDEX "Service_featured_idx" ON "Service"("featured");

-- CreateIndex
CREATE INDEX "ServiceImage_serviceId_idx" ON "ServiceImage"("serviceId");

-- CreateIndex
CREATE INDEX "RoomType_serviceId_idx" ON "RoomType"("serviceId");

-- CreateIndex
CREATE INDEX "RoomAvailability_date_idx" ON "RoomAvailability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RoomAvailability_roomTypeId_date_key" ON "RoomAvailability"("roomTypeId", "date");

-- CreateIndex
CREATE INDEX "CabinTrip_serviceId_departureDate_idx" ON "CabinTrip"("serviceId", "departureDate");

-- CreateIndex
CREATE INDEX "CabinTrip_departureDate_idx" ON "CabinTrip"("departureDate");

-- CreateIndex
CREATE INDEX "RentalVehicle_serviceId_idx" ON "RentalVehicle"("serviceId");

-- CreateIndex
CREATE INDEX "RentalAvailability_date_idx" ON "RentalAvailability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RentalAvailability_rentalVehicleId_date_key" ON "RentalAvailability"("rentalVehicleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TransportInfo_serviceId_key" ON "TransportInfo"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_code_key" ON "BookingRequest"("code");

-- CreateIndex
CREATE INDEX "BookingRequest_status_idx" ON "BookingRequest"("status");

-- CreateIndex
CREATE INDEX "BookingRequest_createdAt_idx" ON "BookingRequest"("createdAt");

-- CreateIndex
CREATE INDEX "BookingRequest_serviceId_idx" ON "BookingRequest"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_published_idx" ON "Article"("published");

-- AddForeignKey
ALTER TABLE "ServiceImage" ADD CONSTRAINT "ServiceImage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAvailability" ADD CONSTRAINT "RoomAvailability_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CabinTrip" ADD CONSTRAINT "CabinTrip_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalVehicle" ADD CONSTRAINT "RentalVehicle_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAvailability" ADD CONSTRAINT "RentalAvailability_rentalVehicleId_fkey" FOREIGN KEY ("rentalVehicleId") REFERENCES "RentalVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportInfo" ADD CONSTRAINT "TransportInfo_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
