-- Chuyển phụ thu (người thêm / check-in sớm / check-out muộn) từ PHÒNG lên HOMESTAY (dùng chung cả home).

-- 1) Thêm cột phụ thu ở cấp dịch vụ (homestay).
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "extraPersonFee" DECIMAL(12,0);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "earlyCheckinFee" DECIMAL(12,0);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "lateCheckoutFee" DECIMAL(12,0);

-- 2) Mang dữ liệu cũ lên cấp home: lấy mức CAO NHẤT đang khai trong các phòng của mỗi home.
UPDATE "Service" s SET
  "extraPersonFee"  = sub.epf,
  "earlyCheckinFee" = sub.ecf,
  "lateCheckoutFee" = sub.lcf
FROM (
  SELECT rt."serviceId" AS sid,
         MAX(r."extraPersonFee")  AS epf,
         MAX(r."earlyCheckinFee") AS ecf,
         MAX(r."lateCheckoutFee") AS lcf
  FROM "Room" r
  JOIN "RoomType" rt ON rt."id" = r."roomTypeId"
  GROUP BY rt."serviceId"
) sub
WHERE s."id" = sub.sid;

-- 3) Bỏ các cột phụ thu ở cấp phòng (không còn dùng).
ALTER TABLE "Room" DROP COLUMN IF EXISTS "extraPersonFee";
ALTER TABLE "Room" DROP COLUMN IF EXISTS "earlyCheckinFee";
ALTER TABLE "Room" DROP COLUMN IF EXISTS "lateCheckoutFee";
