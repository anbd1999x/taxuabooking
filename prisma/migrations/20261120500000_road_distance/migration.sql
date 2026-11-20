-- Bộ nhớ đệm quãng đường xe chạy homestay → điểm xung quanh
CREATE TABLE "RoadDistance" (
    "serviceId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "sig" TEXT NOT NULL,
    "km" DOUBLE PRECISION NOT NULL,
    "minutes" INTEGER NOT NULL,
    "shape" TEXT,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadDistance_pkey" PRIMARY KEY ("serviceId","placeId")
);
