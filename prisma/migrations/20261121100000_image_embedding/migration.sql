-- Vector CLIP của ảnh homestay — tìm homestay theo ảnh
CREATE TABLE "ImageEmbedding" (
    "imageId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "roomTypeId" TEXT,
    "roomId" TEXT,
    "url" TEXT NOT NULL,
    "vec" BYTEA NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageEmbedding_pkey" PRIMARY KEY ("imageId")
);

CREATE INDEX "ImageEmbedding_serviceId_idx" ON "ImageEmbedding"("serviceId");
