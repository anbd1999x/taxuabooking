-- CreateTable
CREATE TABLE "RoomTypeImage" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomTypeImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomTypeImage_roomTypeId_idx" ON "RoomTypeImage"("roomTypeId");

-- AddForeignKey
ALTER TABLE "RoomTypeImage" ADD CONSTRAINT "RoomTypeImage_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
