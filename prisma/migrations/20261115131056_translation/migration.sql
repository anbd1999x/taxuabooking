-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Translation_locale_sourceHash_idx" ON "Translation"("locale", "sourceHash");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_entity_entityId_field_locale_key" ON "Translation"("entity", "entityId", "field", "locale");
