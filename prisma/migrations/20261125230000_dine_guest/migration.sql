-- Gọi món QR: khách khai tên / SĐT / số khách ở màn "Chào mừng" (chụp lên từng lần gọi) + việc cần nhờ khi gọi nhân viên.
ALTER TABLE "DineOrder" ADD COLUMN "guestName" TEXT, ADD COLUMN "guestPhone" TEXT, ADD COLUMN "guestPax" INTEGER;
ALTER TABLE "DineRequest" ADD COLUMN "note" TEXT;
