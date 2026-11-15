-- Các màu xe có sẵn của từng loại xe cho thuê (khách chọn khi đặt).
ALTER TABLE "RentalVehicle" ADD COLUMN "colors" TEXT[] DEFAULT ARRAY[]::TEXT[];
