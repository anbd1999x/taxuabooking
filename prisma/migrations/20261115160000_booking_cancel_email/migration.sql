-- Mốc đã gửi email báo huỷ đơn (chống gửi trùng).
ALTER TABLE "BookingRequest" ADD COLUMN "cancelEmailSentAt" TIMESTAMP(3);
