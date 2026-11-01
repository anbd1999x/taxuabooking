import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { RestaurantList, type RestaurantCard } from "@/components/RestaurantList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nhà hàng & quán ăn Tà Xùa — danh sách đầy đủ",
  description:
    "Danh sách nhà hàng, quán ăn ngon ở Tà Xùa theo từng khu vực: trung tâm, Đỉnh Gió, Khe Cải, Sống lưng khủng long — kèm giá tham khảo, giờ mở và món nên gọi.",
  alternates: { canonical: "/nha-hang" },
};

/** Loại quán hiển thị trên badge thẻ, suy từ tên + tags (chỉ phục vụ trình bày). */
function kindOf(name: string, tags: string): string {
  const t = `${name} ${tags}`.toLowerCase();
  if (/cơm suất|cơm phần|bếp ăn/.test(t)) return "Cơm suất";
  if (/cơm nhà|cơm việt/.test(t)) return "Cơm nhà";
  if (/lẩu|nướng/.test(t)) return "Lẩu nướng";
  if (/mì cay|ăn nhanh/.test(t)) return "Ăn nhanh";
  return "Nhà hàng";
}

/** "Từ 90.000đ" → 90000 (để sắp xếp theo giá). */
function priceNumOf(price: string | null): number | null {
  if (!price) return null;
  const digits = price.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

export default async function NhaHangPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const area = typeof sp.khu === "string" ? sp.khu : "";

  const [places, settings] = await Promise.all([
    prisma.place.findMany({
      where: { kind: "RESTAURANT", published: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getSettings(),
  ]);
  const hotline = settings.contactPhone || SITE.defaultPhone;

  const items: RestaurantCard[] = places.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    area: p.area,
    address: p.address,
    kind: kindOf(p.name, p.tags ?? ""),
    desc: p.desc ?? "",
    tags: (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    price: p.price,
    priceNum: priceNumOf(p.price),
    hours: p.hours,
    phone: p.phone || hotline,
    cover: p.coverImage,
  }));

  return <RestaurantList items={items} initialArea={area} />;
}
