-- Chống spam: lưu IP/trình duyệt gửi đơn + danh sách IP bị chặn.
ALTER TABLE "BookingRequest" ADD COLUMN "clientIp" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "clientUa" TEXT;
CREATE INDEX "BookingRequest_clientIp_idx" ON "BookingRequest"("clientIp");

CREATE TABLE "BlockedIp" (
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("ip")
);
