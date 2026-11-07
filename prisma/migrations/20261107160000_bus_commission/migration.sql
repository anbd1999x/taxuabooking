-- Chiết khấu nhà xe cho sàn: mức trên dịch vụ (đ/khách/chiều) + snapshot trên đơn.
ALTER TABLE "Service" ADD COLUMN "busCommission" DECIMAL(12,0);
ALTER TABLE "BookingRequest" ADD COLUMN "busCommission" DECIMAL(12,0);
