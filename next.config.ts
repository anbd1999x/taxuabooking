import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dữ liệu giá / tình trạng còn chỗ phải luôn tươi mới nên không bật cacheComponents.
  output: "standalone", // tối ưu cho Docker (chỉ copy file cần thiết)
  serverExternalPackages: ["sharp"], // sharp là native, không bundle
  // Không tái dùng client router cache cho trang động: điều hướng mềm (router.push)
  // sang cùng đường dẫn với tham số tìm khác nhau luôn lấy dữ liệu mới (không reload).
  // `static` tối thiểu 30 (Next báo invalid config nếu nhỏ hơn và bỏ qua cả khối).
  experimental: { staleTimes: { dynamic: 0, static: 30 } },
  // Chỉ có tác dụng khi `next dev`: cho phép mở bằng IP mạng LAN (thử trên điện thoại) — thiếu dòng này Next chặn
  // kết nối HMR từ địa chỉ khác localhost ⇒ trang tự tải lại liên tục.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  poweredByHeader: false,
  // Next mặc định chỉ đưa metadata vào <head> cho vài bot (Googlebot, Bingbot…); UA khác (GPTBot, ClaudeBot,
  // PerplexityBot…) nhận <title> / description / canonical ở cuối <body> ⇒ bot không chạy JS coi như trang không tiêu đề.
  // Khớp mọi UA: metadata luôn nằm trong <head> (trang dựng nhanh nên không đáng kể).
  htmlLimitedBots: /.*/,
  images: {
    // Không dùng bộ tối ưu /_next/image (ảnh /uploads thêm lúc chạy không nằm trong bản standalone, container
    // không có DNS ra ngoài cho ảnh Unsplash). Thay bằng loader riêng: ảnh trong site → route /thumb (thu nhỏ theo
    // bề rộng + WebP, lưu đệm ở uploads/.thumbs), ảnh Unsplash → đổi tham số w ngay trên URL của họ.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // Phải khớp THUMB_WIDTHS trong src/lib/image-loader.ts (route /thumb từ chối bề rộng khác).
    deviceSizes: [480, 640, 828, 1080, 1440, 1920],
    imageSizes: [96, 160, 256, 384],
  },
  // File tĩnh trong public/ (banner, icon, ảnh trang hợp tác) mặc định max-age=0 ⇒ lần nào vào cũng hỏi lại server.
  async headers() {
    const week = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }];
    return [
      { source: "/:file(hero-[^/]+\\.jpg|banner\\.jpg)", headers: week },
      { source: "/icons/:path+", headers: week },
      // Chỉ ảnh tĩnh — KHÔNG phủ /hop-tac/demo (route handler dựng dữ liệu demo, không được cache).
      { source: "/hop-tac/:file(xe-[^/]+\\.jpg)", headers: week },
      { source: "/hop-tac/demo/mon/:path+", headers: week },
      { source: "/hop-tac/demo/bia/:path+", headers: week },
      { source: "/audio/:path+", headers: week },
    ];
  },
  // Tailwind v4 được xử lý qua postcss.config.mjs (@tailwindcss/postcss).
};

export default nextConfig;
