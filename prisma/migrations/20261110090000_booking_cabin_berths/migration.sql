-- AlterTable: cách nằm xe cabin theo người (nằm ghép = cabin đôi, nằm riêng = cabin đơn)
ALTER TABLE "BookingRequest" ADD COLUMN "cabinShared" INTEGER;
ALTER TABLE "BookingRequest" ADD COLUMN "cabinSolo" INTEGER;

-- Backfill đơn cũ từ nhãn đã lưu: "... 1 khách nằm ghép (cabin đôi) + 1 khách nằm riêng (cabin đơn ...)"
UPDATE "BookingRequest"
SET
  "cabinShared" = COALESCE(substring("selectionLabel" from '(\d+) khách nằm ghép')::int, 0),
  "cabinSolo"   = COALESCE(substring("selectionLabel" from '(\d+) khách nằm riêng')::int, 0)
WHERE "selectionLabel" ~ '\d+ khách nằm (ghép|riêng)';
