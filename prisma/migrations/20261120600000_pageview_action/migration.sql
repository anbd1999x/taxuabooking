-- Thao tác của khách trên trang (bấm nút, gọi điện, gửi đơn…); null = lượt xem trang
ALTER TABLE "PageView" ADD COLUMN "action" TEXT;
