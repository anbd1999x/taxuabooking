-- Gộp tiếp điểm "Thảo nguyên Tà Xùa" vào điểm "Mỏm cá heo – Cây cô đơn"
-- ⇒ "Thảo nguyên – Mỏm cá heo – Cây cô đơn" (taxi / xe ôm). Idempotent.

DELETE FROM "TransportRoute"
WHERE ("fromPointId" = 'tp_thao_nguyen' AND "toPointId" = 'tp_mom_ca_heo')
   OR ("fromPointId" = 'tp_mom_ca_heo' AND "toPointId" = 'tp_thao_nguyen');

DELETE FROM "TransportRoute" r
WHERE r."fromPointId" = 'tp_thao_nguyen'
  AND EXISTS (SELECT 1 FROM "TransportRoute" o WHERE o."serviceId" = r."serviceId"
    AND ((o."fromPointId" = 'tp_mom_ca_heo' AND o."toPointId" = r."toPointId")
      OR (o."toPointId" = 'tp_mom_ca_heo' AND o."fromPointId" = r."toPointId")));
DELETE FROM "TransportRoute" r
WHERE r."toPointId" = 'tp_thao_nguyen'
  AND EXISTS (SELECT 1 FROM "TransportRoute" o WHERE o."serviceId" = r."serviceId"
    AND ((o."toPointId" = 'tp_mom_ca_heo' AND o."fromPointId" = r."fromPointId")
      OR (o."fromPointId" = 'tp_mom_ca_heo' AND o."toPointId" = r."fromPointId")));

UPDATE "TransportRoute" SET "fromPointId" = 'tp_mom_ca_heo', "updatedAt" = CURRENT_TIMESTAMP WHERE "fromPointId" = 'tp_thao_nguyen';
UPDATE "TransportRoute" SET "toPointId" = 'tp_mom_ca_heo', "updatedAt" = CURRENT_TIMESTAMP WHERE "toPointId" = 'tp_thao_nguyen';

DELETE FROM "TransportPoint" WHERE "id" = 'tp_thao_nguyen';
UPDATE "TransportPoint"
SET "name" = 'Thảo nguyên – Mỏm cá heo – Cây cô đơn', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'tp_mom_ca_heo';
