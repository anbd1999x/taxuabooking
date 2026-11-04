-- Chiết khấu mặc định cả homestay (đ/phòng/đêm) — fallback khi phòng/ngày không khai riêng.
ALTER TABLE "Service" ADD COLUMN "roomCommission" DECIMAL(12,0);

-- Snapshot tổng chiết khấu từng căn của đơn (tiền chủ dịch vụ thực nhận = bán ra − chiết khấu).
ALTER TABLE "BookingRequest" ADD COLUMN "roomCommission" DECIMAL(12,0);
