-- Người lớn / trẻ em theo tuổi: cấu hình miễn phí dưới N tuổi (mỗi home) + lưu tách người lớn/trẻ trên đơn.
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "childFreeUnderAge" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "adults" INTEGER;
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "childrenAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
