-- Chủ homestay tự đăng ký dùng thử
ALTER TABLE "AdminUser" ADD COLUMN "selfSignup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminUser" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
