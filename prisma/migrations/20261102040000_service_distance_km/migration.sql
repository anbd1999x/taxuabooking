-- Khoảng cách tới trung tâm Tà Xùa (km). IF NOT EXISTS để an toàn khi cột đã được thêm tay trên prod.
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "distanceKm" DOUBLE PRECISION;
