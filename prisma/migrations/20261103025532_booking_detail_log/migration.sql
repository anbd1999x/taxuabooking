-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "heldBus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "heldRoom" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BookingLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingLog_bookingId_createdAt_idx" ON "BookingLog"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "BookingLog" ADD CONSTRAINT "BookingLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
