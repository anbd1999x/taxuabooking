-- Gọi món QR tại bàn (nhà hàng) — thêm cột + bảng mới, không đụng dữ liệu cũ.
ALTER TABLE "TicketMenuItem" ADD COLUMN "description" TEXT, ADD COLUMN "hot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TicketTable" ADD COLUMN "qrKey" TEXT;
CREATE TABLE "DineOrder" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'QR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cookingAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "payMethod" TEXT,
    "paidBy" TEXT,
    CONSTRAINT "DineOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DineOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    CONSTRAINT "DineOrderItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DineRequest" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),
    CONSTRAINT "DineRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DineOrder_venueId_status_idx" ON "DineOrder"("venueId", "status");
CREATE INDEX "DineOrder_tableId_status_idx" ON "DineOrder"("tableId", "status");
CREATE INDEX "DineOrder_venueId_paidAt_idx" ON "DineOrder"("venueId", "paidAt");
CREATE INDEX "DineOrderItem_orderId_idx" ON "DineOrderItem"("orderId");
CREATE INDEX "DineOrderItem_menuItemId_idx" ON "DineOrderItem"("menuItemId");
CREATE INDEX "DineRequest_venueId_doneAt_idx" ON "DineRequest"("venueId", "doneAt");
ALTER TABLE "DineOrder" ADD CONSTRAINT "DineOrder_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "TicketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DineOrder" ADD CONSTRAINT "DineOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TicketTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DineOrderItem" ADD CONSTRAINT "DineOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DineOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DineRequest" ADD CONSTRAINT "DineRequest_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "TicketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DineRequest" ADD CONSTRAINT "DineRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TicketTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
