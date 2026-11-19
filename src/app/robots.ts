import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      // /api/i18n/ = JSON bản dịch nội dung trang en/zh/ko — Googlebot cần tải để render đúng ngôn ngữ
      // (quy tắc dài hơn được ưu tiên hơn disallow "/api").
      allow: ["/", "/api/i18n/"],
      // Cửa mở demo là GET có ghi DB (dựng dữ liệu mẫu) + trang demo riêng tư ⇒ không cho bot theo link.
      disallow: ["/admin", "/api", "/hop-tac/demo", "/hop-tac/xe-may/demo", "/demo"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
