-- Taxi / xe ôm: điểm cố định + bảng giá chặng (1 chiều / 2 chiều). Bảng TransportRoute cũ (tuyến chữ tự do) đang trống ⇒ dựng lại.
DROP TABLE IF EXISTS "TransportRoute";

CREATE TABLE "TransportPoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportPoint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransportPoint_name_key" ON "TransportPoint"("name");

CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "fromPointId" TEXT NOT NULL,
    "toPointId" TEXT NOT NULL,
    "priceOneWay" DECIMAL(12,0),
    "priceRoundTrip" DECIMAL(12,0),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TransportRoute_serviceId_idx" ON "TransportRoute"("serviceId");
CREATE UNIQUE INDEX "TransportRoute_serviceId_fromPointId_toPointId_key" ON "TransportRoute"("serviceId", "fromPointId", "toPointId");
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_fromPointId_fkey" FOREIGN KEY ("fromPointId") REFERENCES "TransportPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_toPointId_fkey" FOREIGN KEY ("toPointId") REFERENCES "TransportPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Điểm cố định ban đầu (admin sửa / thêm / ẩn ở /admin/transport-points).
INSERT INTO "TransportPoint" ("id", "name", "area", "sortOrder", "updatedAt") VALUES
  ('tp_trung_tam', 'Trung tâm xã Tà Xùa', 'Trung tâm', 1, CURRENT_TIMESTAMP),
  ('tp_cay_co_don', 'Cây cô đơn', 'Trung tâm', 2, CURRENT_TIMESTAMP),
  ('tp_song_lung', 'Sống lưng khủng long', 'Sống lưng khủng long', 3, CURRENT_TIMESTAMP),
  ('tp_mom_ca_heo', 'Mỏm cá heo', 'Háng Đồng', 4, CURRENT_TIMESTAMP),
  ('tp_thao_nguyen', 'Thảo nguyên Tà Xùa', 'Thảo nguyên', 5, CURRENT_TIMESTAMP),
  ('tp_ho_mat_ngoc', 'Hồ mắt Ngọc', 'Mống Vàng', 6, CURRENT_TIMESTAMP),
  ('tp_nui_doi', 'Núi đôi thiếu nữ', 'Đỉnh Gió', 7, CURRENT_TIMESTAMP),
  ('tp_khe_cai', 'Khe Cải', 'Khe Cải', 8, CURRENT_TIMESTAMP),
  ('tp_bac_yen', 'Thị trấn Bắc Yên', 'Bắc Yên', 9, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
