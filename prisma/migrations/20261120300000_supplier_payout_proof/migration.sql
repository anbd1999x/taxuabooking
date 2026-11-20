-- Ảnh uỷ nhiệm chi khi sàn trả tiền cho nhà cung cấp (nhiều ảnh / đơn / bên)
CREATE TABLE "SupplierPayoutProof" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayoutProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierPayoutProof_bookingId_side_idx" ON "SupplierPayoutProof"("bookingId", "side");

ALTER TABLE "SupplierPayoutProof" ADD CONSTRAINT "SupplierPayoutProof_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
