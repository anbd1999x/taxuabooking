-- Ẩn 11 bài viết trùng chủ đề với bài đầy đủ hơn (không xoá — bật lại được ở /admin/articles).
-- Chạy cùng lúc deploy code có ARTICLE_REDIRECTS (src/lib/article-redirects.ts) ⇒ link cũ 301 về bài giữ lại.
UPDATE "Article" SET "published" = false, "featuredOrder" = 0
WHERE "slug" IN (
  'xe-om-taxi-ta-xua',
  'ca-phe-san-may-ta-xua',
  'gia-ve-xe-cabin-ha-noi-ta-xua',
  'duong-di-ta-xua-tu-ha-noi',
  'lich-trinh-ta-xua-2-ngay-1-dem',
  'lich-trinh-ta-xua-3-ngay-2-dem',
  'ta-xua-cuoi-tuan-dan-van-phong',
  'ta-xua-co-gi-choi',
  'san-may-ta-xua-thang-12-tet',
  'thoi-tiet-ta-xua-theo-thang',
  'nha-xe-nao-di-ta-xua'
);
