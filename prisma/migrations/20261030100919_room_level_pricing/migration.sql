-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "roomId" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "listPrice" DECIMAL(12,0) NOT NULL DEFAULT 0,
ADD COLUMN     "priceFri" DECIMAL(12,0),
ADD COLUMN     "priceMon" DECIMAL(12,0),
ADD COLUMN     "priceSat" DECIMAL(12,0),
ADD COLUMN     "priceSun" DECIMAL(12,0),
ADD COLUMN     "priceThu" DECIMAL(12,0),
ADD COLUMN     "priceTue" DECIMAL(12,0),
ADD COLUMN     "priceWed" DECIMAL(12,0),
ADD COLUMN     "salePrice" DECIMAL(12,0);
