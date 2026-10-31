-- CreateTable
CREATE TABLE "RoomImage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomImage_roomId_idx" ON "RoomImage"("roomId");

-- AddForeignKey
ALTER TABLE "RoomImage" ADD CONSTRAINT "RoomImage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
