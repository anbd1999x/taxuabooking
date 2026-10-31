-- AlterTable
ALTER TABLE "RoomType" ADD COLUMN     "airCon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breakfast" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cloudView" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasBathtub" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "heating" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceFri" DECIMAL(12,0),
ADD COLUMN     "priceMon" DECIMAL(12,0),
ADD COLUMN     "priceSat" DECIMAL(12,0),
ADD COLUMN     "priceSun" DECIMAL(12,0),
ADD COLUMN     "priceThu" DECIMAL(12,0),
ADD COLUMN     "priceTue" DECIMAL(12,0),
ADD COLUMN     "priceWed" DECIMAL(12,0);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "easyRoad" BOOLEAN NOT NULL DEFAULT false;
