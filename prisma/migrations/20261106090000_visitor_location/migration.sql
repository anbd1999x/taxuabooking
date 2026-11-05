-- Vị trí thật của khách (GPS trình duyệt, chỉ khi khách cho phép).
ALTER TABLE "Visitor" ADD COLUMN "lat" DOUBLE PRECISION;
ALTER TABLE "Visitor" ADD COLUMN "lng" DOUBLE PRECISION;
ALTER TABLE "Visitor" ADD COLUMN "locAccuracy" DOUBLE PRECISION;
ALTER TABLE "Visitor" ADD COLUMN "locAddress" TEXT;
ALTER TABLE "Visitor" ADD COLUMN "locAt" TIMESTAMP(3);
