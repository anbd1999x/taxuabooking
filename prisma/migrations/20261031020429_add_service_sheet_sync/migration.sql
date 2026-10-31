-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "sheetSyncResult" TEXT,
ADD COLUMN     "sheetSyncedAt" TIMESTAMP(3),
ADD COLUMN     "sheetUrl" TEXT;
