-- Thuê xe máy: giờ nhận / giờ trả + số ngày tính tiền quy đổi (vd 1.5).
ALTER TABLE "BookingRequest" ADD COLUMN "rentalDays" DECIMAL(5,1), ADD COLUMN "pickupTime" TEXT, ADD COLUMN "returnTime" TEXT;
