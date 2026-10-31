-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "icalToken" TEXT;

-- CreateTable
CREATE TABLE "RoomIcalSource" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomIcalSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomIcalSource_roomId_idx" ON "RoomIcalSource"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_icalToken_key" ON "Room"("icalToken");

-- AddForeignKey
ALTER TABLE "RoomIcalSource" ADD CONSTRAINT "RoomIcalSource_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
