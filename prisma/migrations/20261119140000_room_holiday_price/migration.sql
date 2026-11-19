-- Giá ngày lễ cho từng phòng con (lịch ngày lễ: SiteSetting "holidays").
ALTER TABLE "Room" ADD COLUMN "holidayPrice" DECIMAL(12,0);
