-- Thứ tự ưu tiên khi tìm kiếm combo/homestay (trong nhóm Nổi bật, số lớn hơn lên trước).
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "priorityOrder" INTEGER NOT NULL DEFAULT 0;
