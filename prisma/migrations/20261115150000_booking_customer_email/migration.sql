-- Email khách khi đặt + mốc đã gửi email xác nhận (chống gửi trùng).
ALTER TABLE "BookingRequest" ADD COLUMN "customerEmail" TEXT, ADD COLUMN "confirmEmailSentAt" TIMESTAMP(3);
