-- Nhắc lịch (Web Push) đã gửi cho từng đơn — chống gửi trùng.
CREATE TABLE "BookingReminder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingReminder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingReminder_bookingId_kind_key" ON "BookingReminder"("bookingId", "kind");
CREATE INDEX "BookingReminder_sentAt_idx" ON "BookingReminder"("sentAt");
