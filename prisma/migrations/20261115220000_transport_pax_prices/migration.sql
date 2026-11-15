-- Taxi / xe ôm: sức chở + giá khi xe ôm chở 2 người (nguyên ngày & theo chặng).
ALTER TABLE "TransportInfo" ADD COLUMN "dayPriceTwo" DECIMAL(12,0), ADD COLUMN "capacity" INTEGER;
ALTER TABLE "TransportRoute" ADD COLUMN "priceTwo" DECIMAL(12,0);
