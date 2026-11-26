-- Homestay: có hỗ trợ khách mang hành lý không (+ ghi chú). Đơn xe: homestay khách sẽ ở (admin nhập).
ALTER TABLE "Service" ADD COLUMN "luggage" TEXT, ADD COLUMN "luggageNote" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "guestStay" TEXT;
