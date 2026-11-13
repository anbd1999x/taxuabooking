import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import { placeShareImage } from "@/lib/og-source";
import { prisma } from "@/lib/prisma";
import { CafeList, type CafeCard } from "@/components/cafe/CafeList";

export const dynamic = "force-dynamic";

const META = {
  title: "Cafe Tà Xùa — danh sách quán cà phê săn mây",
  description:
    "Danh sách quán cafe Tà Xùa theo khu vực: Đỉnh Gió, Khe Cải, trung tâm, Sống lưng khủng long — quán view săn mây, lọc theo khung giờ bình minh/hoàng hôn, giá tham khảo.",
  path: "/cafe",
};

/** Ảnh chia sẻ link lấy từ địa điểm thật trong DB (thiếu thì ảnh biển mây). */
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({ ...META, image: await placeShareImage("CAFE") });
}

const MAP = "https://maps.google.com/?q=";

/** "6:00–19:00" | "5:00-22:00" → { open, close } theo số thập phân (5.5 = 5h30). */
function parseHours(hours: string | null): { open: number; close: number } {
  if (hours) {
    const m = hours.replace(/\s/g, "").match(/^(\d{1,2})(?::(\d{2}))?[–-](\d{1,2})(?::(\d{2}))?$/);
    if (m) {
      const open = Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
      const close = Number(m[3]) + (m[4] ? Number(m[4]) / 60 : 0);
      if (open >= 0 && close > open) return { open, close };
    }
  }
  return { open: 6, close: 21 };
}

function deriveAm(text: string): string[] {
  const n = text.toLowerCase();
  const am: string[] = [];
  if (/mây|view|panorama/.test(n)) am.push("view");
  if (/đồ ăn|nhà hàng|lẩu|nướng|ăn sáng|quán ăn|bữa/.test(n)) am.push("food");
  if (/homestay/.test(n)) am.push("stay");
  if (/ngoài trời|hiên|sân vườn|khu vườn/.test(n)) am.push("outdoor");
  if (/khuya|muộn|cocktail|bar/.test(n)) am.push("late");
  return am;
}

function deriveSlots(open: number, close: number, late: boolean): string[] {
  const slots: string[] = [];
  if (open <= 5.5) slots.push("dawn");
  if (open < 17) slots.push("day");
  if (close >= 17.5) slots.push("sunset");
  if (close >= 21 || late) slots.push("night");
  return slots;
}

export default async function CafePage() {
  const places = await prisma.place.findMany({
    where: { kind: "CAFE", published: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const cafes: CafeCard[] = places.map((p) => {
    const rawTags = (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    const feat = rawTags.some((t) => /^gợi ý$/i.test(t));
    const tags = rawTags.filter((t) => !/^gợi ý$/i.test(t));
    const { open, close } = parseHours(p.hours);
    const am = deriveAm(`${p.name} ${p.desc ?? ""} ${rawTags.join(" ")}`);
    const slots = deriveSlots(open, close, am.includes("late"));
    return {
      id: p.id,
      slug: p.slug ?? p.id,
      name: p.name,
      area: p.area,
      dist: p.address ?? "",
      desc: p.desc ?? "",
      tags,
      open,
      close,
      slots,
      am,
      priceText: p.price ?? null,
      mapUrl: p.mapUrl || MAP + encodeURIComponent(`${p.name} Tà Xùa`),
      image: p.coverImage ?? null,
      feat,
    };
  });

  return <CafeList cafes={cafes} />;
}
