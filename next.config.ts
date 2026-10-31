import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dữ liệu giá / tình trạng còn chỗ phải luôn tươi mới nên không bật cacheComponents.
  output: "standalone", // tối ưu cho Docker (chỉ copy file cần thiết)
  serverExternalPackages: ["sharp"], // sharp là native, không bundle
  // Không tái dùng client router cache cho trang động: điều hướng mềm (router.push)
  // sang cùng đường dẫn với tham số tìm khác nhau luôn lấy dữ liệu mới (không reload).
  experimental: { staleTimes: { dynamic: 0, static: 0 } },
  images: {
    // Không tối ưu ảnh phía server: ảnh /uploads do nginx phục vụ tĩnh, còn ảnh
    // Unsplash tải thẳng từ trình duyệt (container không có DNS ra ngoài cho bộ
    // tối ưu). next/image sẽ phát URL gốc thay vì đi qua /_next/image.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  // Tailwind v4 được xử lý qua postcss.config.mjs (@tailwindcss/postcss).
};

export default nextConfig;
