-- Sàn đã thanh toán cho nhà cung cấp trong từng đơn (homestay/dịch vụ chính + nhà xe).
ALTER TABLE "BookingRequest" ADD COLUMN "paidToRoom" DECIMAL(12,0);
ALTER TABLE "BookingRequest" ADD COLUMN "paidToBus" DECIMAL(12,0);
