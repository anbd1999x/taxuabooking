import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dữ liệu giá / tình trạng còn chỗ phải luôn tươi mới nên không bật cacheComponents.
  output: "standalone", // tối ưu cho Docker (chỉ copy file cần thiết)
  serverExternalPackages: ["sharp"], // sharp là native, không bundle
  images: {
    remotePatterns: [
      // Cho phép ảnh seed từ Unsplash trong môi trường dev.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // Tailwind v4 được xử lý qua postcss.config.mjs (@tailwindcss/postcss).
};

export default nextConfig;
