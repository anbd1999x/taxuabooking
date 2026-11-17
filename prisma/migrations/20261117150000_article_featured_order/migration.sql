-- Bài viết nổi bật: STT > 0 = nổi bật, xếp theo STT to → bé; 0 = bài thường.
ALTER TABLE "Article" ADD COLUMN "featuredOrder" INTEGER NOT NULL DEFAULT 0;
