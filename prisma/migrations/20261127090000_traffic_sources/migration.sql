-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "trafficBooked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trafficContacted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trafficCur" TEXT,
ADD COLUMN     "trafficFirst" TEXT,
ADD COLUMN     "trafficLastAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TrafficDaily" (
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "newVisitors" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "booked" INTEGER NOT NULL DEFAULT 0,
    "contacted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrafficDaily_pkey" PRIMARY KEY ("day","source")
);

-- CreateTable
CREATE TABLE "TrafficRefHost" (
    "source" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "ips" TEXT[],
    "lastAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficRefHost_pkey" PRIMARY KEY ("source","host")
);

-- CreateIndex
CREATE INDEX "Visitor_trafficFirst_idx" ON "Visitor"("trafficFirst");

