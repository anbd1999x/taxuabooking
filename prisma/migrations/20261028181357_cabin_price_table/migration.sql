-- CreateTable
CREATE TABLE "CabinPriceRow" (
    "id" TEXT NOT NULL,
    "pickupPoint" TEXT NOT NULL,
    "destination" TEXT NOT NULL DEFAULT 'Tà Xùa',
    "price" DECIMAL(12,0) NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinPriceRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CabinPriceRow_sortOrder_idx" ON "CabinPriceRow"("sortOrder");
