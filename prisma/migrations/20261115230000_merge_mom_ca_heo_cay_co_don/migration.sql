-- Gộp điểm cố định "Cây cô đơn" vào "Mỏm cá heo" thành một điểm "Mỏm cá heo – Cây cô đơn" (taxi / xe ôm).
-- Idempotent: DB đã gộp tay (prod) thì các câu dưới không đổi gì.

-- Chặng nối thẳng 2 điểm này với nhau ⇒ sau khi gộp thành A → A, bỏ.
DELETE FROM "TransportRoute"
WHERE ("fromPointId" = 'tp_cay_co_don' AND "toPointId" = 'tp_mom_ca_heo')
   OR ("fromPointId" = 'tp_mom_ca_heo' AND "toPointId" = 'tp_cay_co_don');

-- Chặng của Cây cô đơn mà bác tài đã khai sẵn chặng tương ứng cho Mỏm cá heo (bất kể hướng) ⇒ bỏ bản trùng.
DELETE FROM "TransportRoute" r
WHERE r."fromPointId" = 'tp_cay_co_don'
  AND EXISTS (SELECT 1 FROM "TransportRoute" o WHERE o."serviceId" = r."serviceId"
    AND ((o."fromPointId" = 'tp_mom_ca_heo' AND o."toPointId" = r."toPointId")
      OR (o."toPointId" = 'tp_mom_ca_heo' AND o."fromPointId" = r."toPointId")));
DELETE FROM "TransportRoute" r
WHERE r."toPointId" = 'tp_cay_co_don'
  AND EXISTS (SELECT 1 FROM "TransportRoute" o WHERE o."serviceId" = r."serviceId"
    AND ((o."toPointId" = 'tp_mom_ca_heo' AND o."fromPointId" = r."fromPointId")
      OR (o."fromPointId" = 'tp_mom_ca_heo' AND o."toPointId" = r."fromPointId")));

-- Các chặng còn lại chuyển sang điểm gộp.
UPDATE "TransportRoute" SET "fromPointId" = 'tp_mom_ca_heo', "updatedAt" = CURRENT_TIMESTAMP WHERE "fromPointId" = 'tp_cay_co_don';
UPDATE "TransportRoute" SET "toPointId" = 'tp_mom_ca_heo', "updatedAt" = CURRENT_TIMESTAMP WHERE "toPointId" = 'tp_cay_co_don';

DELETE FROM "TransportPoint" WHERE "id" = 'tp_cay_co_don';
UPDATE "TransportPoint"
SET "name" = 'Mỏm cá heo – Cây cô đơn', "sortOrder" = 2, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'tp_mom_ca_heo';
