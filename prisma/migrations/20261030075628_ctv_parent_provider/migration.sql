-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "providerId" TEXT;

-- CreateIndex
CREATE INDEX "AdminUser_providerId_idx" ON "AdminUser"("providerId");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
