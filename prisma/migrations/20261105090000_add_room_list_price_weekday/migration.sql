-- Giá gạch (niêm yết) theo thứ cho phòng con — hiển thị gạch ngang cạnh giá-theo-thứ.
ALTER TABLE "Room" ADD COLUMN "listPriceMon" DECIMAL(12,0);
ALTER TABLE "Room" ADD COLUMN "listPriceTue" DECIMAL(12,0);
ALTER TABLE "Room" ADD COLUMN "listPriceWed" DECIMAL(12,0);
ALTER TABLE "Room" ADD COLUMN "listPriceThu" DECIMAL(12,0);
ALTER TABLE "Room" ADD COLUMN "listPriceFri" DECIMAL(12,0);
ALTER TABLE "Room" ADD COLUMN "listPriceSat" DECIMAL(12,0);
ALTER TABLE "Room" ADD COLUMN "listPriceSun" DECIMAL(12,0);
