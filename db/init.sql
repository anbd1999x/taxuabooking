-- =============================================================================
-- Tà Xùa Booking — Khởi tạo database MỚI (PostgreSQL 15+)
-- Sinh từ prisma/schema.prisma (31/10/2026) — khớp 100% với code hiện tại.
--
-- CÁCH DÙNG (chọn 1 trong 3):
--   1) psql thủ công:
--        createdb taxua_trip
--        psql -U postgres -d taxua_trip -f db/init.sql
--   2) Docker Postgres tự chạy khi tạo volume mới: mount vào
--        /docker-entrypoint-initdb.d/init.sql
--   3) KHUYẾN NGHỊ khi deploy bằng docker compose của repo này: KHÔNG cần file
--      này — `npx prisma migrate deploy` tự tạo schema từ prisma/migrations.
--      File này dành cho trường hợp dựng DB tay / không dùng Prisma CLI.
--
-- LƯU Ý nếu sau này muốn dùng `prisma migrate deploy` trên DB đã chạy file này:
--   baseline trước:  npx prisma migrate resolve --applied <tên_migration_cuối>
--
-- Tài khoản quản trị tạo sẵn ở CUỐI FILE: admin / taxua@2026
--   → ĐỔI MẬT KHẨU ngay sau lần đăng nhập đầu (/admin/accounts).
-- =============================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('CABIN', 'HOMESTAY', 'BUNGALOW', 'MOTORBIKE', 'XEOM', 'TAXI', 'COMBO');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'SOLD_OUT', 'NOT_UPDATED', 'PENDING_CONFIRM');

-- CreateEnum
CREATE TYPE "CabinDirection" AS ENUM ('OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "CabinTicketType" AS ENUM ('ROUND_TRIP', 'OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('NEW', 'CONTACTING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CTV', 'PROVIDER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "providerId" TEXT,
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
    "mapUrl" TEXT,
    "policy" TEXT,
    "basePrice" DECIMAL(12,0),
    "priceUnit" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactZalo" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "easyRoad" BOOLEAN NOT NULL DEFAULT false,
    "pool" BOOLEAN NOT NULL DEFAULT false,
    "sheetUrl" TEXT,
    "sheetSyncedAt" TIMESTAMP(3),
    "sheetSyncResult" TEXT,
    "ownerId" TEXT,
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
    "priceMon" DECIMAL(12,0),
    "priceTue" DECIMAL(12,0),
    "priceWed" DECIMAL(12,0),
    "priceThu" DECIMAL(12,0),
    "priceFri" DECIMAL(12,0),
    "priceSat" DECIMAL(12,0),
    "priceSun" DECIMAL(12,0),
    "totalRooms" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "hasBathtub" BOOLEAN NOT NULL DEFAULT false,
    "cloudView" BOOLEAN NOT NULL DEFAULT false,
    "breakfast" BOOLEAN NOT NULL DEFAULT false,
    "airCon" BOOLEAN NOT NULL DEFAULT false,
    "heating" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amenities" TEXT,
    "description" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "listPrice" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(12,0),
    "priceMon" DECIMAL(12,0),
    "priceTue" DECIMAL(12,0),
    "priceWed" DECIMAL(12,0),
    "priceThu" DECIMAL(12,0),
    "priceFri" DECIMAL(12,0),
    "priceSat" DECIMAL(12,0),
    "priceSun" DECIMAL(12,0),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "icalToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomIcalSource" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomIcalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomImage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomDayStatus" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "bookingId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomDayStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomTypeImage" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'image',
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomTypeImage_pkey" PRIMARY KEY ("id")
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
    "direction" "CabinDirection" NOT NULL DEFAULT 'OUTBOUND',
    "departureDate" DATE NOT NULL,
    "departureTime" TEXT NOT NULL,
    "pickupPoint" TEXT NOT NULL,
    "dropoffPoint" TEXT NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "seatsTotal" INTEGER NOT NULL DEFAULT 0,
    "seatsAvailable" INTEGER NOT NULL DEFAULT 0,
    "priceDouble" DECIMAL(12,0),
    "seatsDoubleTotal" INTEGER NOT NULL DEFAULT 0,
    "seatsDoubleAvailable" INTEGER NOT NULL DEFAULT 0,
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
    "roomId" TEXT,
    "cabinTripId" TEXT,
    "cabinReturnTripId" TEXT,
    "seatsSingle" INTEGER,
    "seatsDouble" INTEGER,
    "rentalVehicleId" TEXT,
    "selectionLabel" TEXT,
    "referencePrice" DECIMAL(12,0),
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "inventoryApplied" BOOLEAN NOT NULL DEFAULT false,
    "ctvId" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "CabinPriceRow" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "pickupPoint" TEXT NOT NULL,
    "destination" TEXT NOT NULL DEFAULT 'Tà Xùa',
    "ticketType" "CabinTicketType" NOT NULL DEFAULT 'ROUND_TRIP',
    "price" DECIMAL(12,0) NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinPriceRow_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_providerId_idx" ON "AdminUser"("providerId");

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
CREATE UNIQUE INDEX "Room_icalToken_key" ON "Room"("icalToken");

-- CreateIndex
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");

-- CreateIndex
CREATE INDEX "RoomIcalSource_roomId_idx" ON "RoomIcalSource"("roomId");

-- CreateIndex
CREATE INDEX "RoomImage_roomId_idx" ON "RoomImage"("roomId");

-- CreateIndex
CREATE INDEX "RoomDayStatus_date_idx" ON "RoomDayStatus"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RoomDayStatus_roomId_date_key" ON "RoomDayStatus"("roomId", "date");

-- CreateIndex
CREATE INDEX "RoomTypeImage_roomTypeId_idx" ON "RoomTypeImage"("roomTypeId");

-- CreateIndex
CREATE INDEX "RoomAvailability_date_idx" ON "RoomAvailability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RoomAvailability_roomTypeId_date_key" ON "RoomAvailability"("roomTypeId", "date");

-- CreateIndex
CREATE INDEX "CabinTrip_serviceId_departureDate_direction_idx" ON "CabinTrip"("serviceId", "departureDate", "direction");

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
CREATE INDEX "BookingRequest_ctvId_idx" ON "BookingRequest"("ctvId");

-- CreateIndex
CREATE INDEX "BookingRequest_paymentStatus_idx" ON "BookingRequest"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_published_idx" ON "Article"("published");

-- CreateIndex
CREATE INDEX "CabinPriceRow_serviceId_idx" ON "CabinPriceRow"("serviceId");

-- CreateIndex
CREATE INDEX "CabinPriceRow_sortOrder_idx" ON "CabinPriceRow"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CabinRoute_serviceId_direction_key" ON "CabinRoute"("serviceId", "direction");

-- CreateIndex
CREATE INDEX "CabinRouteStop_routeId_idx" ON "CabinRouteStop"("routeId");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceImage" ADD CONSTRAINT "ServiceImage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomIcalSource" ADD CONSTRAINT "RoomIcalSource_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomImage" ADD CONSTRAINT "RoomImage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomDayStatus" ADD CONSTRAINT "RoomDayStatus_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTypeImage" ADD CONSTRAINT "RoomTypeImage_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_ctvId_fkey" FOREIGN KEY ("ctvId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CabinPriceRow" ADD CONSTRAINT "CabinPriceRow_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CabinRoute" ADD CONSTRAINT "CabinRoute_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CabinRouteStop" ADD CONSTRAINT "CabinRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CabinRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- DỮ LIỆU KHỞI TẠO TỐI THIỂU
-- =============================================================================

-- Tài khoản quản trị: admin / taxua@2026  (hash bcrypt 10 vòng)
-- ⚠️ ĐỔI MẬT KHẨU ngay sau lần đăng nhập đầu tiên!
INSERT INTO "AdminUser" ("id", "username", "passwordHash", "name", "role", "active", "updatedAt")
VALUES (
  'adm_root_0001',
  'admin',
  '$2a$10$HxnW5RJBJo5J65FTsUVbVe6faNR8OlujtgNoZQGViR3vYyHa0FL0G',
  'Quản trị viên',
  'ADMIN',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;

-- Thông tin liên hệ hiển thị trên website (sửa trong admin hoặc tại đây)
INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES
  ('contactPhone', '0357452952', CURRENT_TIMESTAMP),
  ('contactZalo',  '0357452952', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
