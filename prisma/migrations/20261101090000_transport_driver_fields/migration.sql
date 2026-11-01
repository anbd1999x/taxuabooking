-- AlterTable: thêm thông tin bác tài cho xe ôm / taxi
ALTER TABLE "TransportInfo" ADD COLUMN "driverName" TEXT;
ALTER TABLE "TransportInfo" ADD COLUMN "driverPhone" TEXT;
ALTER TABLE "TransportInfo" ADD COLUMN "driverBirthYear" INTEGER;
