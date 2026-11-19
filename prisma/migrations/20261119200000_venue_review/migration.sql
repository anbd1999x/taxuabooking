ALTER TABLE "TicketVenue" ADD COLUMN "review" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "TicketVenue" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "TicketVenue" ADD COLUMN "submittedAt" TIMESTAMP(3);
