"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ITINERARY_KEY, sanitizeConfig, type ItineraryConfig } from "@/lib/itinerary";

export interface ItineraryActionState {
  ok?: boolean;
  error?: string;
}

/** Lưu toàn bộ cấu hình trang /lich-trinh (lịch trình + địa điểm nổi bật + lưu ý chuẩn bị). */
export async function saveItinerary(input: ItineraryConfig): Promise<ItineraryActionState> {
  await requireAdmin();
  const cfg = sanitizeConfig(input);
  if (!cfg || !cfg.plans.length) return { error: "Cần ít nhất 1 lịch trình." };
  for (const p of cfg.plans) {
    const label = p.name || "Chưa đặt tên";
    if (!p.name) return { error: "Có lịch trình chưa đặt tên ngắn." };
    if (!p.days.length) return { error: `"${label}": cần ít nhất 1 ngày.` };
    for (const [i, d] of p.days.entries()) {
      if (!d.stops.length) return { error: `"${label}" – Ngày ${i + 1}: chưa có điểm dừng nào.` };
      if (d.stops.some((s) => !s.time)) return { error: `"${label}" – Ngày ${i + 1}: có điểm thiếu giờ (định dạng HH:MM).` };
      if (d.stops.some((s) => !s.placeId && !s.name)) return { error: `"${label}" – Ngày ${i + 1}: điểm tự nhập cần có tên.` };
    }
  }
  // Chỉ giữ id địa điểm còn tồn tại (tránh trỏ tới quán đã xoá).
  const ids = new Set((await prisma.place.findMany({ select: { id: true } })).map((p) => p.id));
  for (const p of cfg.plans) for (const d of p.days) for (const s of d.stops) if (s.placeId && !ids.has(s.placeId)) s.placeId = null;
  for (const k of ["checkin", "cafe", "food"] as const) cfg.featured[k] = cfg.featured[k].filter((id) => ids.has(id));

  const value = JSON.stringify(cfg);
  try {
    await prisma.siteSetting.upsert({ where: { key: ITINERARY_KEY }, create: { key: ITINERARY_KEY, value }, update: { value } });
  } catch {
    return { error: "Lưu lịch trình thất bại." };
  }
  revalidatePath("/lich-trinh");
  revalidatePath("/admin/itinerary");
  return { ok: true };
}
