-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "hkAt" TIMESTAMP(3),
ADD COLUMN     "hkStatus" TEXT NOT NULL DEFAULT 'clean';

-- AlterTable
ALTER TABLE "RoomDayStatus" ADD COLUMN     "stayId" TEXT;

-- CreateTable
CREATE TABLE "RoomStay" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bookingId" TEXT,
    "groupId" TEXT,
    "groupName" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "guestList" JSONB NOT NULL DEFAULT '[]',
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "total" DECIMAL(12,0) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Gọi điện',
    "note" TEXT,
    "state" TEXT,
    "holdUntil" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "fees" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomStay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StayPayment" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,0) NOT NULL,
    "method" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "by" TEXT,

    CONSTRAINT "StayPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeConfig" (
    "serviceId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeConfig_pkey" PRIMARY KEY ("serviceId")
);

-- CreateTable
CREATE TABLE "HomeClose" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "roomIds" TEXT[],
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeExpense" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,0) NOT NULL,
    "note" TEXT,
    "by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomServiceLog" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "what" TEXT NOT NULL,
    "cost" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomStay_code_key" ON "RoomStay"("code");

-- CreateIndex
CREATE INDEX "RoomStay_serviceId_checkOut_idx" ON "RoomStay"("serviceId", "checkOut");

-- CreateIndex
CREATE INDEX "RoomStay_roomId_checkIn_idx" ON "RoomStay"("roomId", "checkIn");

-- CreateIndex
CREATE INDEX "RoomStay_bookingId_idx" ON "RoomStay"("bookingId");

-- CreateIndex
CREATE INDEX "StayPayment_stayId_idx" ON "StayPayment"("stayId");

-- CreateIndex
CREATE INDEX "StayPayment_at_idx" ON "StayPayment"("at");

-- CreateIndex
CREATE INDEX "HomeClose_serviceId_idx" ON "HomeClose"("serviceId");

-- CreateIndex
CREATE INDEX "HomeExpense_serviceId_date_idx" ON "HomeExpense"("serviceId", "date");

-- CreateIndex
CREATE INDEX "RoomServiceLog_roomId_idx" ON "RoomServiceLog"("roomId");

-- CreateIndex
CREATE INDEX "RoomDayStatus_stayId_idx" ON "RoomDayStatus"("stayId");

-- AddForeignKey
ALTER TABLE "RoomStay" ADD CONSTRAINT "RoomStay_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStay" ADD CONSTRAINT "RoomStay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StayPayment" ADD CONSTRAINT "StayPayment_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "RoomStay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeConfig" ADD CONSTRAINT "HomeConfig_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeClose" ADD CONSTRAINT "HomeClose_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeExpense" ADD CONSTRAINT "HomeExpense_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomServiceLog" ADD CONSTRAINT "RoomServiceLog_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
