/**
 * Bài viết đã GỘP / GỠ (trùng chủ đề với bài đầy đủ hơn) ⇒ chuyển hướng 301 về bài giữ lại,
 * để link cũ (Google, Zalo, link trong các bài khác) không thành 404.
 * Chỉ có hiệu lực khi bài gốc đã ẩn (published = false) hoặc đã xoá.
 * Khoá = slug bài cũ, giá trị = đường dẫn đích (không có tiền tố ngôn ngữ).
 */
export const ARTICLE_REDIRECTS: Record<string, string> = {
  "xe-om-taxi-ta-xua": "/kinh-nghiem/gia-xe-om-taxi-ta-xua",
  "ca-phe-san-may-ta-xua": "/kinh-nghiem/quan-ca-phe-san-may-ta-xua-theo-khu",
  "gia-ve-xe-cabin-ha-noi-ta-xua": "/kinh-nghiem/dat-xe-di-ta-xua",
  "duong-di-ta-xua-tu-ha-noi": "/kinh-nghiem/ta-xua-o-dau-cach-ha-noi-bao-nhieu-km",
  "lich-trinh-ta-xua-2-ngay-1-dem": "/lich-trinh",
  "lich-trinh-ta-xua-3-ngay-2-dem": "/lich-trinh",
  "ta-xua-cuoi-tuan-dan-van-phong": "/kinh-nghiem/48-gio-o-ta-xua-nhat-ky",
  "ta-xua-co-gi-choi": "/kinh-nghiem/ban-do-du-lich-ta-xua-diem-check-in",
  "san-may-ta-xua-thang-12-tet": "/kinh-nghiem/ta-xua-mua-dong-lanh-mac-gi",
  "thoi-tiet-ta-xua-theo-thang": "/kinh-nghiem/ta-xua-mua-nao-dep-nhat",
  "nha-xe-nao-di-ta-xua": "/kinh-nghiem/nha-xe-di-ta-xua",
};
