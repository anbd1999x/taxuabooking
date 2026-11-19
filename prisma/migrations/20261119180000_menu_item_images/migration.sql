-- Món ăn có nhiều ảnh (thực đơn QR hiện dạng trượt). Ảnh bìa cũ (imageUrl) được chép thành ảnh đầu tiên.
ALTER TABLE "TicketMenuItem" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "TicketMenuItem" SET "images" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> '';
