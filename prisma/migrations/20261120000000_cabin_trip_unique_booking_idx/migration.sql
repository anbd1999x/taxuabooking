-- BK-7: mỗi nhà xe chỉ MỘT chuyến thật mỗi ngày + chiều (chuyến ảo materialize song song từng tạo trùng).
-- Đã kiểm dữ liệu production 19/11/2026: không có nhóm (serviceId, departureDate, direction) trùng.
DROP INDEX IF EXISTS "CabinTrip_serviceId_departureDate_direction_idx";
CREATE UNIQUE INDEX "CabinTrip_serviceId_departureDate_direction_key" ON "CabinTrip"("serviceId", "departureDate", "direction");

-- PERF-2: đơn theo chuyến (badge/trang đơn nhà xe, lịch vé cabin) và danh sách đơn admin lọc theo ngày đi.
CREATE INDEX "BookingRequest_cabinTripId_idx" ON "BookingRequest"("cabinTripId");
CREATE INDEX "BookingRequest_cabinReturnTripId_idx" ON "BookingRequest"("cabinReturnTripId");
CREATE INDEX "BookingRequest_useDate_idx" ON "BookingRequest"("useDate");
