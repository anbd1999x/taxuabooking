-- Module Vé & đặt bàn (vé cổng / show / nhà hàng) — chỉ thêm bảng mới.
CREATE TABLE "TicketVenue" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "description" TEXT,
    "coverImage" TEXT,
    "ownerId" TEXT,
    "placeId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "layout" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketVenue_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketTier" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "listPrice" DECIMAL(12,0),
    "seatClass" TEXT,
    "quota" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketMenuItem" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "price" DECIMAL(12,0) NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TicketMenuItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketTable" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "zone" TEXT NOT NULL DEFAULT 'Trong nhà',
    "floor" INTEGER NOT NULL DEFAULT 0,
    "round" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TicketTable_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketSession" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL DEFAULT '',
    "quota" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'Web',
    "ctvId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'wait',
    "ticketAmount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "foodAmount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "paid" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "payMethod" TEXT,
    "holdUntil" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    CONSTRAINT "TicketOrderItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TicketSeat" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketSeat_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'entry',
    "label" TEXT NOT NULL,
    "seatKey" TEXT,
    "usedAt" TIMESTAMP(3),
    "usedBy" TEXT,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TicketVenue_slug_key" ON "TicketVenue"("slug");
CREATE INDEX "TicketVenue_kind_published_idx" ON "TicketVenue"("kind", "published");
CREATE INDEX "TicketVenue_ownerId_idx" ON "TicketVenue"("ownerId");
CREATE INDEX "TicketTier_venueId_idx" ON "TicketTier"("venueId");
CREATE INDEX "TicketMenuItem_venueId_idx" ON "TicketMenuItem"("venueId");
CREATE UNIQUE INDEX "TicketTable_venueId_name_key" ON "TicketTable"("venueId", "name");
CREATE UNIQUE INDEX "TicketSession_venueId_date_time_key" ON "TicketSession"("venueId", "date", "time");
CREATE UNIQUE INDEX "TicketOrder_code_key" ON "TicketOrder"("code");
CREATE UNIQUE INDEX "TicketOrder_token_key" ON "TicketOrder"("token");
CREATE INDEX "TicketOrder_venueId_status_idx" ON "TicketOrder"("venueId", "status");
CREATE INDEX "TicketOrder_sessionId_idx" ON "TicketOrder"("sessionId");
CREATE INDEX "TicketOrder_phone_idx" ON "TicketOrder"("phone");
CREATE INDEX "TicketOrderItem_orderId_idx" ON "TicketOrderItem"("orderId");
CREATE UNIQUE INDEX "TicketSeat_sessionId_key_key" ON "TicketSeat"("sessionId", "key");
CREATE INDEX "TicketSeat_orderId_idx" ON "TicketSeat"("orderId");
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");
CREATE UNIQUE INDEX "Ticket_token_key" ON "Ticket"("token");
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "TicketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketMenuItem" ADD CONSTRAINT "TicketMenuItem_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "TicketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketTable" ADD CONSTRAINT "TicketTable_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "TicketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketSession" ADD CONSTRAINT "TicketSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "TicketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "TicketVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TicketSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketOrderItem" ADD CONSTRAINT "TicketOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketSeat" ADD CONSTRAINT "TicketSeat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TicketSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketSeat" ADD CONSTRAINT "TicketSeat_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
