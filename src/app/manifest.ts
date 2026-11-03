import type { MetadataRoute } from "next";

/**
 * Manifest PWA — chủ yếu để admin "Thêm vào Màn hình chính" trên iPhone
 * (điều kiện bắt buộc để iOS nhận Web Push thông báo đơn mới).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tà Xùa Booking",
    short_name: "Tà Xùa",
    description: "Đặt xe cabin, homestay, combo du lịch Tà Xùa",
    start_url: "/admin",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d4733",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
