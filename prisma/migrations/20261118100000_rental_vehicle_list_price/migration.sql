-- Giá gạch (giá gốc/ngày) cấu hình theo TỪNG LOẠI XE cho thuê, thay cho giá gạch chung của cửa hàng.
ALTER TABLE "RentalVehicle" ADD COLUMN "listPrice" DECIMAL(12,0);

-- Chuyển giá gạch chung đang dùng sang đúng loại xe đang hiển thị nó trên web
-- (cửa hàng 1 loại xe, hoặc loại xe có giá = giá "từ" của cửa hàng).
UPDATE "RentalVehicle" v
SET "listPrice" = s."originalPrice"
FROM "Service" s
WHERE s."id" = v."serviceId"
  AND s."category" = 'MOTORBIKE'
  AND s."originalPrice" IS NOT NULL
  AND s."originalPrice" > v."pricePerDay"
  AND (
    v."pricePerDay" = s."basePrice"
    OR (SELECT count(*) FROM "RentalVehicle" x WHERE x."serviceId" = s."id") = 1
  );
