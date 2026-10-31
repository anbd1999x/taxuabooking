-- AlterTable: SĐT thành tuỳ chọn (tài khoản OAuth không có SĐT) + thêm email
ALTER TABLE "CustomerUser" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "CustomerUser" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerUser_email_key" ON "CustomerUser"("email");
