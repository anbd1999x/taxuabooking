-- CreateTable
CREATE TABLE "SheetSyncLog" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "summary" TEXT NOT NULL,
    "changes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SheetSyncLog_serviceId_createdAt_idx" ON "SheetSyncLog"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "SheetSyncLog_createdAt_idx" ON "SheetSyncLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SheetSyncLog" ADD CONSTRAINT "SheetSyncLog_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
