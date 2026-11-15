-- Ai thu tiền khách của đơn: PLATFORM (sàn) | PROVIDER (chủ dịch vụ).
ALTER TABLE "BookingRequest" ADD COLUMN "collector" TEXT NOT NULL DEFAULT 'PLATFORM';
